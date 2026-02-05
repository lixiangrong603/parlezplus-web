
import { AzureWord, TranscriptSegment, WordTiming } from '../types';

// French Liaison Rules configuration
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'y', 'à', 'â', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'û', 'ù', 'œ'];
const LIAISON_CONSONANTS = ['s', 'x', 'z', 't', 'd', 'n', 'p', 'r', 'g'];
const H_ASPIRE = [
  'héros', 'héroïne', 'haut', 'hauteur', 'haricot', 'hibou', 'hache', 'hall', 'halte', 
  'hamac', 'hameau', 'hanche', 'handicap', 'hangar', 'happer', 'harasser', 'harceler', 
  'hardi', 'hareng', 'hargne', 'harpe', 'hasard', 'hâte', 'haie', 'haine', 'haïr', 
  'haleter', 'happer', 'harnais', 'honte', 'hoquet', 'hors', 'houblon', 'houle', 'housse',
  'hublot', 'huile', 'huit', 'hurler', 'hussard', 'hollandais', 'hongrois'
];
const OBLIGATORY_STARTERS = new Set([
  'un', 'des', 'les', 'ces', 'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'nos', 'vos', 'leurs', 'aux', 'aucun', 'tout', 'tous', 'quels', 'quelles',
  'on', 'nous', 'vous', 'ils', 'elles', 'en', 'y', 'dont', 'quand',
  'chez', 'dans', 'sans', 'sous', 
  'très', 'trop', 'plus', 'bien', 'rien', 'jamais', 'mieux', 'moins',
  'est', 'sont', 'ont', 'suis' 
]);

export const analyzeFrenchLiaison = (text: string) => {
  // Split by space but keep punctuation attached to check for pauses
  const words = text.split(/\s+/);
  
  return words.map((word, index) => {
    // 1. Basic Cleaning
    const cleanWord = word.toLowerCase().replace(/[^a-zàâéèêëîïôûùçœ]/g, '');
    
    // Default: No Liaison
    const result = { text: word, needsLiaison: false };

    // --- NO LIAISON CONDITIONS ---
    
    // Empty
    if (!cleanWord) return result;

    // Punctuation check (comma, dot, etc. usually stop liaison)
    if (/[.,!?;:]$/.test(word)) return result;

    // "Et" never links
    if (cleanWord === 'et') return result;

    // Last word has no next word
    const nextRawWord = words[index + 1];
    if (!nextRawWord) return result; 

    // Next word cleaning
    const cleanNextWord = nextRawWord.toLowerCase().replace(/[^a-zàâéèêëîïôûùçœ]/g, '');
    if (!cleanNextWord) return result;

    // Check H-aspiré
    if (H_ASPIRE.includes(cleanNextWord)) return result;

    // --- POTENTIAL LIAISON ---

    const lastChar = cleanWord.slice(-1);
    const firstCharNext = cleanNextWord.charAt(0);

    // Rule: Consonant ending + Vowel/H-muet beginning
    if (LIAISON_CONSONANTS.includes(lastChar) && (VOWELS.includes(firstCharNext) || firstCharNext === 'h')) {
        
        // Rule: Obligatory words (Determiners, Pronouns, Prepositions)
        if (OBLIGATORY_STARTERS.has(cleanWord)) {
            result.needsLiaison = true;
            return result;
        }
        
        // Rule: Adjective + Noun (Common pre-nominal adjectives)
        const ADJECTIVES = ['grand', 'petit', 'bon', 'mauvais', 'gros', 'long', 'premier', 'dernier', 'beaux', 'vieux', 'faux'];
        if (ADJECTIVES.includes(cleanWord)) {
             result.needsLiaison = true;
             return result;
        }

        // Rule: Numbers
        const NUMBERS = ['deux', 'trois', 'six', 'dix', 'vingt', 'cent'];
        if (NUMBERS.includes(cleanWord)) {
            result.needsLiaison = true;
            return result;
        }

        // Rule: Verb + Pronoun (ont-ils) - usually covered by regex checks or specific logic, 
        // but here we rely on standard grammatical structures.
        // For simplicity in this "Smart" MVP, we are conservative. 
        // If it looks like a liaison but isn't in the mandatory list, we default to false (teacher can enable).
        // However, standard teaching often encourages 'Optional' liaisons in formal speech. 
        // Let's enable liaison for 'est' (is) specifically as it's very common.
        if (cleanWord === 'est' || cleanWord === 'sont' || cleanWord === 'ont') {
             result.needsLiaison = true;
             return result;
        }
    }

    return result;
  });
};

// Helper to normalize strings for comparison (remove punctuation, lower case)
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9àâéèêëîïôûùçœ]/g, '');

// --- Robust Alignment Logic (Needleman-Wunsch) ---

export const alignTextToAzureWords = (rawWords: AzureWord[], textWithNewlines: string): TranscriptSegment[] => {
    // 0. Pre-process Raw Azure Words
    const normalizedRawWords = rawWords.map(w => ({
        ...w,
        offset: w.offset > 100000 ? w.offset / 10000000 : w.offset, 
        duration: w.duration > 100000 ? w.duration / 10000000 : w.duration
    }));

    // 1. Prepare User Data
    const lines = textWithNewlines.split('\n');
    
    interface UserWordNode {
        text: string;
        lineIndex: number;
        normalized: string;
        startTime?: number;
        endTime?: number;
    }

    const userWords: UserWordNode[] = [];
    
    lines.forEach((line, lineIdx) => {
        const words = line.trim().split(/\s+/);
        words.forEach(w => {
            if (!w) return;
            const norm = normalize(w);
            userWords.push({
                text: w,
                lineIndex: lineIdx,
                normalized: norm
            });
        });
    });

    const N = normalizedRawWords.length;
    const M = userWords.length;

    // DP Arrays
    const score = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
    const ptr = Array.from({ length: N + 1 }, () => new Int8Array(M + 1)); 
    
    const MATCH_SCORE = 10;
    const MISMATCH_SCORE = -2; 
    const GAP_SCORE = -5;

    // Init boundary
    for (let i = 0; i <= N; i++) {
        score[i][0] = i * GAP_SCORE;
        ptr[i][0] = 2; // Delete
    }
    for (let j = 0; j <= M; j++) {
        score[0][j] = j * GAP_SCORE;
        ptr[0][j] = 3; // Insert
    }

    // Fill Matrix
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            const userW = userWords[j - 1].normalized;
            
            if (!userW) {
                score[i][j] = score[i][j-1]; 
                ptr[i][j] = 3; 
                continue;
            }

            const azureW = normalize(normalizedRawWords[i - 1].word);
            
            const isMatch = azureW === userW;
            const matchScore = score[i - 1][j - 1] + (isMatch ? MATCH_SCORE : MISMATCH_SCORE);
            const deleteScore = score[i - 1][j] + GAP_SCORE;
            const insertScore = score[i][j - 1] + GAP_SCORE;

            if (matchScore >= deleteScore && matchScore >= insertScore) {
                score[i][j] = matchScore;
                ptr[i][j] = 1;
            } else if (deleteScore >= insertScore) {
                score[i][j] = deleteScore;
                ptr[i][j] = 2;
            } else {
                score[i][j] = insertScore;
                ptr[i][j] = 3;
            }
        }
    }

    // Backtrack
    let i = N;
    let j = M;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && ptr[i][j] === 1) {
            const azureWord = normalizedRawWords[i - 1];
            userWords[j - 1].startTime = azureWord.offset;
            userWords[j - 1].endTime = azureWord.offset + azureWord.duration;
            i--;
            j--;
        } else if (i > 0 && (j === 0 || ptr[i][j] === 2)) {
            i--;
        } else {
            j--;
        }
    }

    // Interpolate Missing Timestamps
    for (let k = 0; k < userWords.length; k++) {
        if (userWords[k].startTime === undefined) {
            let prevEnd = 0;
            let p = k - 1;
            while (p >= 0) {
                if (userWords[p].endTime !== undefined) {
                    prevEnd = userWords[p].endTime!;
                    break;
                }
                p--;
            }
            if (p < 0 && normalizedRawWords.length > 0) prevEnd = normalizedRawWords[0].offset;

            let nextStart = 0;
            let n = k + 1;
            while (n < userWords.length) {
                if (userWords[n].startTime !== undefined) {
                    nextStart = userWords[n].startTime!;
                    break;
                }
                n++;
            }
            if (n >= userWords.length && normalizedRawWords.length > 0) {
                const last = normalizedRawWords[normalizedRawWords.length - 1];
                nextStart = last.offset + last.duration;
            }

            const gap = Math.max(0, nextStart - prevEnd);
            const count = n - p - 1; 
            const indexInGap = k - p; 
            const durationPerWord = gap / (count + 1);
            
            userWords[k].startTime = prevEnd + (durationPerWord * indexInGap) - (durationPerWord * 0.9); 
            userWords[k].endTime = prevEnd + (durationPerWord * indexInGap);
            if (userWords[k].startTime! < prevEnd) userWords[k].startTime = prevEnd;
        }
    }

    // Reconstruct TranscriptSegments
    const segments: TranscriptSegment[] = [];
    const wordsByLine: UserWordNode[][] = Array.from({ length: lines.length }, () => []);
    userWords.forEach(w => wordsByLine[w.lineIndex].push(w));

    wordsByLine.forEach((lineWords, idx) => {
        const originalText = lines[idx].trim();
        if (!originalText) return;

        let start = 0;
        let end = 0;

        if (lineWords.length > 0) {
            start = lineWords[0].startTime || 0;
            end = lineWords[lineWords.length - 1].endTime || 0;
        } else {
            const prevSeg = segments[segments.length - 1];
            start = prevSeg ? prevSeg.endTime : 0;
            end = start + 0.5;
        }

        const analyzed = analyzeFrenchLiaison(originalText);
        
        const finalWords: WordTiming[] = [];
        const segDur = end - start;

        analyzed.forEach((aw, i) => {
             let wStart = start;
             let wEnd = end;
             
             if (i < lineWords.length) {
                 wStart = lineWords[i].startTime || start;
                 wEnd = lineWords[i].endTime || end;
             } else {
                 wStart = start + (i / analyzed.length) * segDur;
                 wEnd = start + ((i + 1) / analyzed.length) * segDur;
             }

             finalWords.push({
                 word: aw.text,
                 startTime: Number(wStart.toFixed(3)),
                 endTime: Number(wEnd.toFixed(3)),
                 needsLiaison: aw.needsLiaison // This now comes from analyzeFrenchLiaison
             });
        });

        segments.push({
            id: `seg-${Date.now()}-${idx}`,
            text: originalText,
            translation: '', 
            startTime: Number(start.toFixed(2)),
            endTime: Number(Math.max(end, start + 0.1).toFixed(2)),
            words: finalWords
        });
    });

    return segments;
};

// [新增] 解析上传的 JSON 格式字幕文件
export const parseSubtitleJson = (jsonContent: string): { transcript: TranscriptSegment[], rawAzureWords: AzureWord[] } | null => {
  try {
    const data = JSON.parse(jsonContent);
    // Check basic structure
    if (!data.words || !Array.isArray(data.words)) return null;

    // Extract raw words
    const rawAzureWords: AzureWord[] = data.words.map((w: any) => ({
      word: w.text || w.Word, // Handle both key formats if present
      offset: w.offset !== undefined ? w.offset : (w.Offset || 0),
      duration: w.duration !== undefined ? w.duration : (w.Duration || 0)
    }));

    // Determine the split lines (sentences)
    let textForAlignment = "";
    if (data.auto_split_lines && Array.isArray(data.auto_split_lines)) {
      textForAlignment = data.auto_split_lines.join('\n');
    } else if (data.segments && Array.isArray(data.segments)) {
      // If segments exist, use their text
      textForAlignment = data.segments.map((s: any) => s.text).join('\n');
    } else if (data.full_text) {
      // Fallback to full_text
      textForAlignment = data.full_text;
    }

    if (!textForAlignment && rawAzureWords.length > 0) {
        // Ultimate fallback: reconstruct text from words
        textForAlignment = rawAzureWords.map(w => w.word).join(' ');
    }

    // Re-run alignment to generate consistent segment structure
    const transcript = alignTextToAzureWords(rawAzureWords, textForAlignment);
    
    return { transcript, rawAzureWords };
  } catch (e) {
    console.error("JSON Parse Error", e);
    return null;
  }
};
