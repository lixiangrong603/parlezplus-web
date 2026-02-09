
// This factory creates a Web Worker using a Blob URL.
// The worker code is embedded as a string to ensure it loads correctly in all environments
// without requiring specific server-side configuration for worker files.

export const createAiWorker = (): Worker => {
  const workerCode = `
import * as SpeechSDK from 'https://esm.sh/microsoft-cognitiveservices-speech-sdk@1.47.0';
import { GoogleGenAI } from 'https://esm.sh/@google/genai';

const handleAzureTranscribe = async (id, payload) => {
    const { audioBlob, key, region } = payload;
    
    if (!audioBlob) throw new Error("Audio Blob is missing");
    
    const arrayBuffer = await audioBlob.arrayBuffer();
    const pushStream = SpeechSDK.AudioInputStream.createPushStream();
    pushStream.write(arrayBuffer);
    pushStream.close();

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechRecognitionLanguage = "fr-FR";
    speechConfig.requestWordLevelTimestamps();
    speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

    const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    const allWords = [];
    let fullDisplayText = "";

    recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            const text = e.result.text;
            if (text) {
                fullDisplayText += (fullDisplayText ? " " : "") + text;
            }

            try {
                const json = JSON.parse(e.result.json);
                if (json.NBest && json.NBest.length > 0 && json.NBest[0].Words) {
                    const words = json.NBest[0].Words;
                    words.forEach((w) => {
                        allWords.push({
                            word: w.Word,
                            offset: w.Offset / 10000000,
                            duration: w.Duration / 10000000
                        });
                    });
                }
            } catch (jsonErr) {
                console.warn("JSON Parse warning in worker", jsonErr);
            }
            
            self.postMessage({ type: 'PROGRESS', id, payload: "识别中: " + (text ? text.substring(0, 15) + "..." : "...") });
        }
    };

    await new Promise((resolve, reject) => {
        recognizer.sessionStopped = () => {
            recognizer.stopContinuousRecognitionAsync(() => {
                recognizer.close();
                resolve(null);
            });
        };
        recognizer.canceled = (s, e) => {
            resolve(null);
        };
        recognizer.startContinuousRecognitionAsync(() => {}, (err) => reject(err));
    });

    self.postMessage({ 
        type: 'SUCCESS', 
        id, 
        result: { words: allWords, fullText: fullDisplayText } 
    });
};

const handleAzureAssessFull = async (id, payload) => {
    const { audioBlob, referenceText, key, region, geminiKey } = payload;

    if (!key || !region) throw new Error("Azure credentials missing");
    if (!audioBlob) throw new Error("Audio missing");

    const arrayBuffer = await audioBlob.arrayBuffer();
    const pushStream = SpeechSDK.AudioInputStream.createPushStream();
    pushStream.write(arrayBuffer);
    pushStream.close();

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechRecognitionLanguage = "fr-FR";
    const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);

    const cleanRefText = referenceText
        .replace(/[.,\\/#!$%\\^&\\*;:{}=\\-_\\x60~()?«»]/g, "")
        .replace(/\\s{2,}/g, " ")
        .trim();

    const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
        cleanRefText,
        SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
        SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
        true
    );

    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    pronunciationConfig.applyTo(recognizer);

    let azureResult = null;

    try {
        await new Promise((resolve, reject) => {
            recognizer.recognizeOnceAsync(
                (result) => {
                    if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                        const rawJson = result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
                        azureResult = JSON.parse(rawJson);
                        resolve(null);
                    } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
                        reject(new Error("No speech recognized (NoMatch)."));
                    } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                         const details = SpeechSDK.CancellationDetails.fromResult(result);
                         reject(new Error("Azure Canceled: " + details.errorDetails));
                    }
                    recognizer.close();
                },
                (err) => {
                    recognizer.close();
                    reject(err);
                }
            );
        });
    } catch (e) {
        throw new Error("Azure Assessment Failed: " + e.message);
    }

    if (!azureResult || !azureResult.NBest || azureResult.NBest.length === 0) {
        throw new Error("Invalid Azure Result");
    }

    const assessment = azureResult.NBest[0].PronunciationAssessment;
    const wordsData = azureResult.NBest[0].Words || [];

    const cleanWords = wordsData.map((w) => ({
        word: w.Word,
        score: w.PronunciationAssessment?.AccuracyScore || 0,
    }));

    const weakWords = cleanWords
        .filter((w) => w.score < 80)
        .map((w) => w.word)
        .slice(0, 12);

    let generalFeedback = "Azure 评估完成。请查看详细维度的得分与单词发音标记。";

    // Use Gemini 3 Flash for personalized feedback if key is present
    if (geminiKey && geminiKey.trim().length > 5) {
        try {
            self.postMessage({ type: 'PROGRESS', id, progress: "正在通过 Gemini 生成评语..." });
            
            const promptContent = "你是一位专业的法语口语教练。请根据学生的朗读得分提供简短评价：\\n" +
                "- 综合得分: " + (assessment.PronScore || 0) + "\\n" +
                "- 准确度: " + (assessment.AccuracyScore || 0) + "\\n" +
                "- 流利度: " + (assessment.FluencyScore || 0) + "\\n" +
                "- 建议纠正的单词: " + (weakWords.join(', ') || '表现完美') + "\\n" +
                "请用中文写一段50字左右的鼓励性评语，指出一个亮点和一个改进点。";

            const requestBody = {
                model: 'gemini-3-flash-preview',
                contents: [{ parts: [{ text: promptContent }] }]
            };
            
            const response = await fetch('/api/proxy-gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${geminiKey}\`
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(\`Gemini proxy failed: \${response.status}\`);
            }
            
            const data = await response.json();
            if (data && data.text) {
                generalFeedback = data.text.trim();
            }
        } catch (geminiError) {
            console.error("Gemini call failed in worker:", geminiError);
            let detailedError = "API 限制或网络问题失败";
            if (geminiError.message && geminiError.message.includes('API key not valid')) {
                detailedError = "Gemini API Key 无效，请在教师设置中检查";
            }
            generalFeedback = "Azure 评估完成（Gemini 反馈生成由于 " + detailedError + "）。";
        }
    }

    const finalResponse = {
        overallScore: Math.round(assessment.PronScore || 0),
        correctness: Math.round(assessment.AccuracyScore || 0),
        completeness: Math.round(assessment.CompletenessScore || 0),
        fluency: Math.round(assessment.FluencyScore || 0),
        prosody: 0,
        generalFeedback: generalFeedback,
        words: cleanWords
    };

    const wrappedResult = {
        segmentEvaluations: [
            {
                id: "full-assessment", 
                ...finalResponse
            }
        ]
    };

    self.postMessage({ type: 'SUCCESS', id, result: { evaluationResult: wrappedResult } });
};

const handleGeminiCorrect = async (id, payload) => {
    const { segments, apiKey } = payload;
    if (!apiKey) throw new Error("API Key missing");
    
    // 使用代理 API 而非直连 Gemini（绕过中国 GFW）
    const segmentPayload = segments.map((s) => ({ id: s.id, text: s.id + ": " + s.text }));
    
    const requestBody = {
        model: 'gemini-3-flash-preview',
        contents: [{ 
            parts: [{ 
                text: "Translate the following French segments to Simplified Chinese. Return as a JSON array of objects with 'id' and 'translation'. Segments: " + JSON.stringify(segmentPayload) 
            }] 
        }],
        config: { responseMimeType: "application/json" }
    };
    
    const response = await fetch('/api/proxy-gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\` // 使用存储的 token（非 Gemini key）
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        throw new Error(\`Gemini API proxy failed: \${response.status}\`);
    }
    
    const data = await response.json();
    let jsonStr = data.text.trim();
    if (jsonStr.startsWith("\x60\x60\x60")) jsonStr = jsonStr.replace(/\x60+json|\x60+/g, "");
    
    try {
        const results = JSON.parse(jsonStr);
        self.postMessage({ type: 'SUCCESS', id, result: results });
    } catch (e) {
        throw new Error("Failed to parse JSON response from Gemini");
    }
};

const handleGeminiGenerateQuiz = async (id, payload) => {
    const { fullText, count, difficulty, apiKey } = payload;
    if (!apiKey) throw new Error("API Key missing");
    
    const prompt = "Create " + count + " TCF-style reading comprehension questions (level " + difficulty + ") for the following French text: \\"" + fullText + "\\". Return as a valid JSON array of objects, each containing: 'text' (the question), 'options' (array of 4 objects with 'text' and 'isCorrect' boolean), and 'explanation' (in Chinese).";

    const requestBody = {
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    };
    
    const response = await fetch('/api/proxy-gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        throw new Error(\`Gemini API proxy failed: \${response.status}\`);
    }
    
    const data = await response.json();

    try {
        const rawQuestions = JSON.parse(data.text);
        const finalQuestions = rawQuestions.map((q, idx) => {
            const qId = "q-" + Date.now() + "-" + idx;
            const options = q.options.map((opt, oIdx) => ({
                id: "opt-" + qId + "-" + oIdx,
                text: opt.text
            }));
            const correctIndex = q.options.findIndex((o) => o.isCorrect);
            return {
                id: qId,
                text: q.text,
                options: options,
                correctOptionId: correctIndex >= 0 ? options[correctIndex].id : options[0].id,
                explanation: q.explanation
            };
        });
        self.postMessage({ type: 'SUCCESS', id, result: finalQuestions });
    } catch (e) {
        throw new Error("Failed to parse JSON quiz response: " + e.message);
    }
};

const handleGeminiGenerateSyllabusQuiz = async (id, payload) => {
    const { knowledgePoints, count, difficulty, type, subQuestionCount, apiKey, customPrompt } = payload;
    
    if (!apiKey) throw new Error("API Key missing");

    // 1. Role & General Instruction
    let prompt = "As an excellent French language teacher following the CEFR standards, generate " + count + " high-quality questions for Level " + difficulty + ".\\n";
    prompt += "Core Principles: \\n";
    prompt += "- Content must be AUTHENTIC and REAL-LIFE oriented, avoid rigid textbook style.\\n";
    prompt += "- Language must be natural and appropriate for Level " + difficulty + ".\\n";
    prompt += "- Explanations must be in Simplified Chinese.\\n";
    
    if (customPrompt) {
        prompt += "- Additional Teacher Instructions: " + customPrompt + "\\n\\n";
    } else {
        prompt += "\\n";
    }

    // 2. Knowledge Point Strategy
    const topics = knowledgePoints.map((kp, idx) => "[" + idx + "] " + kp.name).join(", ");
    prompt += "Target Knowledge Points (with index): " + topics + ".\\n";
    
    // Calculate total count: for ALL types, we generate count * knowledgePoints.length items
    const isPassageType = type === 'reading-comprehension' || type === 'cloze-test' || type === 'compound-fill';
    const totalCount = count * knowledgePoints.length;
    
    // Ensure even distribution and correct assignment
    if (!isPassageType) {
        prompt += "IMPORTANT DISTRIBUTION RULE:\\n";
        prompt += "- You MUST generate EXACTLY " + totalCount + " questions in total.\\n";
        prompt += "- Generate " + count + " question(s) for EACH of the " + knowledgePoints.length + " knowledge points.\\n";
        prompt += "- Each question MUST include 'knowledgePointIndex' (integer) to indicate which knowledge point it tests.\\n";
        prompt += "- For example, if testing [0] 'voiture', set knowledgePointIndex: 0.\\n";
    } else {
        prompt += "IMPORTANT DISTRIBUTION RULE:\\n";
        prompt += "- You MUST generate EXACTLY " + totalCount + " passages in total.\\n";
        prompt += "- Generate " + count + " passage(s) for EACH of the " + knowledgePoints.length + " knowledge points.\\n";
        prompt += "- Each passage MUST include 'knowledgePointIndex' (integer) to indicate the primary knowledge point it covers.\\n";
        prompt += "- For example, if a passage focuses on [0] 'voiture', set knowledgePointIndex: 0.\\n";
    }
    
    const kpTypes = new Set(knowledgePoints.map((kp) => kp.type));
    
    // --- STRATEGY: Vocabulary ---
    if (kpTypes.has('vocabulary')) {
        prompt += "STRATEGY FOR VOCABULARY:\\n";
        prompt += "- Treat the Knowledge Point name (e.g. 'voiture') as the **EXACT TARGET WORD**.\\n";
        prompt += "- The Correct Option MUST be this specific word (or its correct conjugation/form).\\n";
        prompt += "- Do NOT generate general questions about the topic (e.g. if topic is 'car', do NOT ask 'how many wheels').\\n";
        prompt += "- Instead, create a sentence where the specific word is the only logical fit.\\n";
    }
    
    // --- STRATEGY: Grammar ---
    if (kpTypes.has('grammar')) {
        prompt += "STRATEGY FOR GRAMMAR:\\n";
        prompt += "- Test the usage in real-life conversational or written contexts.\\n";
        prompt += "- Focus on the specific grammatical structure provided in the Knowledge Point.\\n";
    }
    
    // --- STRATEGY: Question Length & Structure ---
    if (type === 'reading-comprehension') {
        prompt += "STRATEGY FOR READING COMPREHENSION:\\n";
        prompt += "- Create short passages appropriate for " + difficulty + ":\\n";
        prompt += "  * A1-A2: < 100 words.\\n";
        prompt += "  * B1-B2: 150-300 words.\\n";
        prompt += "  * C1-C2: 250-350 words.\\n";
        prompt += "- Questions should require inference, summary, or paraphrasing.\\n";
    } else if (type === 'cloze-test') {
        prompt += "STRATEGY FOR CLOZE SELECTION (完型选择):\\n";
        prompt += "- Create a coherent short passage appropriate for Level " + difficulty + ".\\n";
        prompt += "- Replace " + (subQuestionCount || 5) + " key words with numbered placeholders: {{1}}, {{2}}, etc.\\n";
        prompt += "- Create a multiple-choice question for each blank.\\n";
    } else if (type === 'compound-fill') {
        prompt += "STRATEGY FOR COMPOUND FILL-IN (复合填空):\\n";
        prompt += "- Create a comprehensive passage (approx 200 words) appropriate for Level " + difficulty + ".\\n";
        prompt += "- Identify " + (subQuestionCount || 5) + " key words (verbs, nouns, adjectives related to Knowledge Points) to remove.\\n";
        prompt += "- Replace these words in the text with numbered placeholders in the format '{{1}}', '{{2}}', etc.\\n";
        prompt += "- Provide the exact correct word and a Chinese explanation/definition for each gap.\\n";
    } else if (type === 'fill-in-the-blank') {
        prompt += "STRATEGY FOR FILL-IN-THE-BLANK (Single Sentence):\\n";
        prompt += "- The 'text' must be a SINGLE SENTENCE stem containing '___' for the blank.\\n";
        prompt += "- NO PARAGRAPHS.\\n";
        prompt += "- The student must type the answer, so ensure the blank has a single, unambiguous correct word/phrase.\\n";
    } else {
        // For Multiple Choice
        prompt += "STRATEGY FOR STEMS (IMPORTANT):\\n";
        prompt += "- The 'text' (Question Stem) MUST be a **SINGLE SENTENCE** (or max 2 closely related sentences).\\n";
        prompt += "- STRICTLY NO PARAGRAPHS for single questions.\\n";
        prompt += "- Keep stems concise (approx 15-25 words) to focus on the target point.\\n";
    }

    // 3. Question Type & JSON Schema
    prompt += "\\nFormat Requirements (Strict JSON):\\n";

    if (type === 'reading-comprehension') {
        prompt += "Type: Reading Comprehension (Compound).\\n";
        prompt += "Generate " + totalCount + " entries. Each entry is a passage with " + (subQuestionCount || 3) + " sub-questions.\\n";
        prompt += "Output JSON Schema:\\n" +
        "Array<{\\n" +
        "  readingPassage: string, // The article text\\n" +
        "  subQuestions: Array<{\\n" +
        "     text: string, // The question stem\\n" +
        "     options: Array<{ text: string, isCorrect: boolean }>, // Exactly 4 options\\n" +
        "     explanation: string // Chinese explanation\\n" +
        "  }>\\n" +
        "}>";
    } else if (type === 'cloze-test') {
        prompt += "Type: Cloze Selection (完型选择 - Multiple Choice).\\n";
        prompt += "Generate " + totalCount + " entries (passages). Each passage contains " + (subQuestionCount || 5) + " blanks {{1}}, {{2}}...\\n";
        prompt += "Output JSON Schema:\\n" +
        "Array<{\\n" +
        "  readingPassage: string, // The text with {{1}}, {{2}} placeholders\\n" +
        "  subQuestions: Array<{\\n" +
        "     text: string, // Label like 'Question (1)'\\n" +
        "     options: Array<{ text: string, isCorrect: boolean }>, // Exactly 4 options\\n" +
        "     explanation: string // Chinese explanation\\n" +
        "  }>\\n" +
        "}>>";
    } else if (type === 'compound-fill') {
        prompt += "Type: Compound Fill-in (复合填空 - Type in Answer).\\n";
        prompt += "Generate " + totalCount + " entries. Each entry is a passage with " + (subQuestionCount || 5) + " gaps.\\n";
        prompt += "Output JSON Schema:\\n" +
        "Array<{\\n" +
        "  readingPassage: string, // The text with placeholders like '{{1}}', '{{2}}', etc.\\n" +
        "  subQuestions: Array<{\\n" +
        "     text: string, // The Gap Label (e.g. 'Gap 1')\\n" +
        "     answer: string, // The exact correct word to fill in\\n" +
        "     explanation: string // Rich info: 'Word type (noun/verb) - Chinese Definition/Usage note'. Example: 'verb - 决定 (decider)'\\n" +
        "  }>\\n" +
        "}>";
    } else if (type === 'fill-in-the-blank') {
        prompt += "Type: Fill-in-the-blank (Type-in Cloze).\\n";
        prompt += "Output JSON Schema:\\n" +
        "Array<{\\n" +
        "  text: string, // SINGLE SENTENCE stem containing '___' for the blank. NO PARAGRAPHS.\\n" +
        "  answer: string, // The exact correct word/phrase to fill in.\\n" +
        "  explanation: string // Chinese explanation\\n" +
        "}>";
    } else {
        // Default Multiple Choice
        prompt += "Type: Single Selection (Multiple Choice).\\n";
        prompt += "Output JSON Schema:\\n" +
        "Array<{\\n" +
        "  text: string, // SINGLE SENTENCE question. NO PARAGRAPHS.\\n" +
        "  options: Array<{ text: string, isCorrect: boolean }>, // Exactly 4 options\\n" +
        "  explanation: string // Chinese explanation\\n" +
        "}>";
    }

    const requestBody = {
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
          responseMimeType: "application/json"
      }
    };
    
    const fetchResponse = await fetch('/api/proxy-gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${apiKey}\`
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!fetchResponse.ok) {
        throw new Error(\`Gemini proxy failed: \${fetchResponse.status}\`);
    }
    
    const response = await fetchResponse.json();

        self.postMessage({ type: 'PROGRESS', id, progress: 'Gemini: 已收到响应，正在解析题目...' });

    try {
        self.postMessage({ type: 'PROGRESS', id, progress: 'Gemini: 正在解析 JSON 并构建题目结构...' });
        const rawQuestions = JSON.parse(response.text);
        
        const finalQuestions = rawQuestions.map((q, idx) => {
            const qId = "gen-" + Date.now() + "-" + idx;
            
            // Determine the knowledge point for this question
            // AI returns knowledgePointIndex, fallback to round-robin if not provided
            let kpIndex = typeof q.knowledgePointIndex === 'number' ? q.knowledgePointIndex : (idx % knowledgePoints.length);
            // Clamp to valid range
            if (kpIndex < 0 || kpIndex >= knowledgePoints.length) {
                kpIndex = idx % knowledgePoints.length;
            }
            const assignedKnowledgePointId = knowledgePoints[kpIndex]?.id;
            
            let subQuestions = undefined;
            if ((type === 'reading-comprehension' || type === 'cloze-test' || type === 'compound-fill') && q.subQuestions) {
                subQuestions = q.subQuestions.map((sq, sIdx) => {
                    const sqId = qId + "-sub-" + sIdx;
                    let sqOptions = [];
                    let correctOptionId = "";

                    if (type === 'compound-fill') {
                        // For compound-fill, we store the answer in the first option
                        const ans = sq.answer || "";
                        const optId = "opt-" + sqId + "-ans";
                        sqOptions = [{ id: optId, text: ans }];
                        correctOptionId = optId;
                    } else {
                        // For MC-based types
                        sqOptions = sq.options.map((opt, oIdx) => ({
                            id: "opt-" + sqId + "-" + oIdx,
                            text: opt.text
                        }));
                        const correctIndex = sq.options.findIndex((o) => o.isCorrect);
                        correctOptionId = correctIndex >= 0 ? sqOptions[correctIndex].id : sqOptions[0].id;
                    }

                    return {
                        id: sqId,
                        text: sq.text || ("Gap " + (sIdx + 1)), // FIXED: Removed nested template literal syntax error
                        options: sqOptions,
                        correctOptionId: correctOptionId,
                        explanation: sq.explanation,
                        type: type === 'compound-fill' ? 'fill-in-the-blank' : 'multiple-choice'
                    };
                });
            }

            let options = [];
            let correctOptionId = "";
            
            if (type === 'fill-in-the-blank') {
                const ans = q.answer || (q.options && q.options.find(o => o.isCorrect)?.text) || "";
                const optId = "opt-" + qId + "-answer";
                options = [{ id: optId, text: ans }];
                correctOptionId = optId;
            } else if (q.options) {
                options = q.options.map((opt, oIdx) => ({
                    id: "opt-" + qId + "-" + oIdx,
                    text: opt.text
                }));
                const correctIndex = q.options.findIndex((o) => o.isCorrect);
                correctOptionId = correctIndex >= 0 ? options[correctIndex].id : options[0].id;
            }

            return {
                id: qId,
                text: q.text || "",
                readingPassage: q.readingPassage,
                subQuestions: subQuestions,
                options: options,
                correctOptionId: correctOptionId,
                explanation: q.explanation || "",
                level: difficulty,
                type: type,
                knowledgePointIds: assignedKnowledgePointId ? [assignedKnowledgePointId] : [],
                createdBy: 'ai',
                createdAt: Date.now()
            };
        });

        self.postMessage({ type: 'SUCCESS', id, result: finalQuestions });
    } catch (e) {
        console.error("Gemini JSON Parse Error", e);
        throw new Error("Failed to parse AI response: " + e.message);
    }
};

self.onmessage = async (e) => {
    const { id, type, payload } = e.data;

    try {
        switch (type) {
            case 'AZURE_TRANSCRIBE':
                await handleAzureTranscribe(id, payload);
                break;
            case 'AZURE_ASSESS_FULL':
                await handleAzureAssessFull(id, payload);
                break;
            case 'GEMINI_CORRECT':
                await handleGeminiCorrect(id, payload);
                break;
            case 'GEMINI_GENERATE_QUIZ':
                await handleGeminiGenerateQuiz(id, payload);
                break;
            case 'GEMINI_GENERATE_SYLLABUS_QUIZ':
                await handleGeminiGenerateSyllabusQuiz(id, payload);
                break;
            default:
                throw new Error("Unknown worker message type: " + type);
        }
    } catch (error) {
        self.postMessage({ type: 'ERROR', id, error: error.message || String(error) });
    }
};
`;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob), { type: 'module' });
};
