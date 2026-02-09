import { ExamPaper, Question, User, SyllabusCourse, Unit, KnowledgePoint, MediaResource } from '../types';
import { getSyllabusCourses, getResources } from '../utils/storage';

export interface AnalysisData {
  // Category percentages
  grammarPct: number;
  vocabPct: number;
  readingPct: number;
  otherPct: number;
  
  // Total metrics
  totalQuestions: number;
  totalScore: number;
  averagePointsPerQuestion: number;
  
  // Section analysis
  sectionAnalysis: Array<{
    sectionTitle: string;
    questionCount: number;
    totalPoints: number;
    percentage: number;
  }>;
  
  // Type & Level distribution
  typeDistribution: Record<string, number>;
  levelDistribution: Record<string, number>;
  
  // Knowledge point hierarchy
  hierarchy: {
    courseId: string | 'root';
    courseName: string;
    units: {
      unitId: string;
      unitName: string;
      totalUnitScore: number;
      points: {
        pointId: string;
        pointName: string;
        pointType: string;
        score: number;
      }[];
    }[];
  }[];
  
  // Issues/suggestions
  issues: Array<{ type: 'warning' | 'error' | 'info'; message: string; id: string }>;
}

type NormalizedCategory = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'OTHER';

const normalizeCategory = (question: Question): NormalizedCategory => {
  // Check knowledge point type first
  if (question.knowledgePointIds && question.knowledgePointIds.length > 0) {
    // We'll need to look up the knowledge point type from syllabus
    // This will be handled in the main function
    return 'OTHER'; // Placeholder
  }
  
  // Fall back to question type
  if (question.type === 'reading-comprehension') {
    return 'READING';
  }
  
  // Default to OTHER
  return 'OTHER';
};

export async function calculateExamAnalysis(params: {
  exam: ExamPaper;
  user: User;
  allQuestions: Question[];
}): Promise<AnalysisData> {
  const { exam, user, allQuestions } = params;
  
  // Load syllabus courses
  const allCourses = getSyllabusCourses(user.id);
  
  // Load all resources
  const allResources = await getResources(user.id);
  
  // Create lookup maps
  const questionMap = new Map<string, Question>();
  allQuestions.forEach(q => questionMap.set(q.id, q));
  
  // Build question to resource map
  const questionToResourceMap = new Map<string, MediaResource>();
  allResources.forEach(resource => {
    if (resource.questions && resource.questions.length > 0) {
      resource.questions.forEach(q => {
        questionToResourceMap.set(q.id, resource);
      });
    }
  });
  
  // Build knowledge point map
  const kpMap = new Map<string, { kp: KnowledgePoint; unit: Unit; course: SyllabusCourse }>();
  allCourses.forEach(course => {
    course.units.forEach(unit => {
      unit.knowledgePoints.forEach(kp => {
        kpMap.set(kp.id, { kp, unit, course });
      });
    });
  });
  
  // Initialize stats
  let totalQuestions = 0;
  let totalScore = 0;
  const categoryStats = {
    grammar: 0,
    vocab: 0,
    reading: 0,
    other: 0,
  };
  
  // Type and level distributions
  const typeDistribution: Record<string, number> = {};
  const levelDistribution: Record<string, number> = {};
  
  // Hierarchy tracking
  const hierarchyMap = new Map<
    string,
    {
      courseName: string;
      units: Map<
        string,
        {
          unitName: string;
          totalScore: number;
          points: Map<string, { name: string; type: string; score: number }>;
        }
      >;
    }
  >();
  
  // Process each question
  exam.sections.forEach(section => {
    section.items.forEach(item => {
      const q = questionMap.get(item.questionId);
      if (!q) return;
      
      totalQuestions++;
      totalScore += item.points;
      
      // Type distribution
      if (q.type) {
        typeDistribution[q.type] = (typeDistribution[q.type] || 0) + 1;
      }
      
      // Level distribution
      if (q.level) {
        levelDistribution[q.level] = (levelDistribution[q.level] || 0) + 1;
      }
      
      // Category analysis
      let category: NormalizedCategory = 'OTHER';
      let courseId = 'root';
      let courseName = '未分类';
      let unitId = 'unknown';
      let unitName = '未知单元';
      let pointId = 'unknown';
      let pointName = '未知知识点';
      let pointType = 'other';
      
      // Check if question is from a media resource first
      const resource = questionToResourceMap.get(item.questionId!);
      if (resource) {
        // Question is from a media resource
        courseId = 'media-resources';
        courseName = '多媒体资源';
        unitId = resource.id;
        unitName = resource.title;
        
        // Build combined tag display
        const grammarTagsText = resource.grammarTags && resource.grammarTags.length > 0
          ? resource.grammarTags.join(', ')
          : '语法未标记';
        
        const vocabTagsText = resource.vocabTags && resource.vocabTags.length > 0
          ? resource.vocabTags.join(', ')
          : '词汇未标记';
        
        // Combine into single knowledge point
        pointId = resource.id;
        pointName = `${grammarTagsText} | ${vocabTagsText}`;
        pointType = 'mixed'; // Mixed type for resources with both grammar and vocab
        
        // Determine primary category based on tag availability
        const hasGrammar = resource.grammarTags && resource.grammarTags.length > 0;
        const hasVocab = resource.vocabTags && resource.vocabTags.length > 0;
        
        if (hasGrammar && hasVocab) {
          // Both present, count as half grammar and half vocab
          categoryStats.grammar += 0.5;
          categoryStats.vocab += 0.5;
        } else if (hasGrammar) {
          categoryStats.grammar++;
        } else if (hasVocab) {
          categoryStats.vocab++;
        } else {
          categoryStats.other++;
        }
        
        // Build hierarchy
        if (!hierarchyMap.has(courseId)) {
          hierarchyMap.set(courseId, { courseName, units: new Map() });
        }
        const courseData = hierarchyMap.get(courseId)!;
        
        if (!courseData.units.has(unitId)) {
          courseData.units.set(unitId, { unitName, totalScore: 0, points: new Map() });
        }
        const unitData = courseData.units.get(unitId)!;
        
        unitData.totalScore += item.points;
        
        // Add single point entry with full score
        if (!unitData.points.has(pointId)) {
          unitData.points.set(pointId, { name: pointName, type: pointType, score: 0 });
        }
        unitData.points.get(pointId)!.score += item.points;
        
        // Skip the rest of the processing for this question
        return;
      }
      
      // Try to find knowledge point
      if (q.knowledgePointIds && q.knowledgePointIds.length > 0) {
        const kpId = q.knowledgePointIds[0]; // Use first knowledge point
        const kpData = kpMap.get(kpId);
        
        if (kpData) {
          courseId = kpData.course.id;
          courseName = kpData.course.name;
          unitId = kpData.unit.id;
          unitName = kpData.unit.name;
          pointId = kpData.kp.id;
          pointName = kpData.kp.name;
          pointType = kpData.kp.type;
          
          // Determine category from knowledge point type
          if (kpData.kp.type === 'grammar') category = 'GRAMMAR';
          else if (kpData.kp.type === 'vocabulary') category = 'VOCABULARY';
          else if (kpData.kp.type === 'reading') category = 'READING';
          else category = 'OTHER';
        }
      } else if (q.knowledgePointName) {
        // Use AI-labeled knowledge point name
        pointName = q.knowledgePointName;
      }
      
      // Fall back to question type if no knowledge point found
      if (category === 'OTHER' && q.type === 'reading-comprehension') {
        category = 'READING';
        pointType = 'reading';
      }
      
      // Update category stats
      if (category === 'GRAMMAR') categoryStats.grammar++;
      else if (category === 'VOCABULARY') categoryStats.vocab++;
      else if (category === 'READING') categoryStats.reading++;
      else categoryStats.other++;
      
      // Build hierarchy
      if (!hierarchyMap.has(courseId)) {
        hierarchyMap.set(courseId, { courseName, units: new Map() });
      }
      const courseData = hierarchyMap.get(courseId)!;
      
      if (!courseData.units.has(unitId)) {
        courseData.units.set(unitId, { unitName, totalScore: 0, points: new Map() });
      }
      const unitData = courseData.units.get(unitId)!;
      
      unitData.totalScore += item.points;
      
      if (!unitData.points.has(pointId)) {
        unitData.points.set(pointId, { name: pointName, type: pointType, score: 0 });
      }
      unitData.points.get(pointId)!.score += item.points;
    });
  });
  
  // Calculate category percentages
  const total = totalQuestions || 1;
  let grammarPct = Math.round((categoryStats.grammar / total) * 100);
  let vocabPct = Math.round((categoryStats.vocab / total) * 100);
  let readingPct = Math.round((categoryStats.reading / total) * 100);
  let otherPct = Math.round((categoryStats.other / total) * 100);
  
  // Adjust for rounding
  const sum = grammarPct + vocabPct + readingPct + otherPct;
  const diff = 100 - sum;
  if (diff !== 0) {
    const candidates = [
      { key: 'grammar', count: categoryStats.grammar },
      { key: 'vocab', count: categoryStats.vocab },
      { key: 'reading', count: categoryStats.reading },
    ];
    candidates.sort((a, b) => b.count - a.count);
    const target = candidates[0]?.key || 'vocab';
    if (target === 'grammar') grammarPct += diff;
    else if (target === 'reading') readingPct += diff;
    else vocabPct += diff;
  }
  
  // Build section analysis
  const sectionAnalysis = exam.sections.map(section => {
    const sectionQuestions = section.items.length;
    const sectionPoints = section.items.reduce((sum, item) => sum + item.points, 0);
    
    return {
      sectionTitle: section.title,
      questionCount: sectionQuestions,
      totalPoints: sectionPoints,
      percentage: totalScore > 0 ? (sectionPoints / totalScore) * 100 : 0,
    };
  });
  
  // Build hierarchy
  const hierarchy = Array.from(hierarchyMap.entries()).map(([courseId, courseData]) => ({
    courseId,
    courseName: courseData.courseName,
    units: Array.from(courseData.units.entries()).map(([unitId, unitData]) => ({
      unitId,
      unitName: unitData.unitName,
      totalUnitScore: unitData.totalScore,
      points: Array.from(unitData.points.entries()).map(([pointId, pointData]) => ({
        pointId,
        pointName: pointData.name,
        pointType: pointData.type,
        score: pointData.score,
      })),
    })),
  }));
  
  // Generate issues
  const issues: Array<{ type: 'warning' | 'error' | 'info'; message: string; id: string }> = [];
  
  if (totalQuestions === 0) {
    issues.push({ type: 'error', message: '试卷中没有题目', id: 'no-questions' });
  }
  
  if (totalScore === 0) {
    issues.push({ type: 'error', message: '总分为0，请设置分值', id: 'zero-score' });
  }
  
  if (totalQuestions > 0 && totalQuestions < 5) {
    issues.push({ type: 'warning', message: '题目数量较少，建议增加题目', id: 'few-questions' });
  }
  
  const averagePointsPerQuestion = totalQuestions > 0 ? totalScore / totalQuestions : 0;
  
  if (averagePointsPerQuestion < 1) {
    issues.push({ type: 'info', message: '平均分值较低，可以考虑增加单题分值', id: 'low-average' });
  }
  
  const maxPercentage = Math.max(...sectionAnalysis.map(s => s.percentage));
  if (maxPercentage > 60 && exam.sections.length > 1) {
    issues.push({ 
      type: 'warning', 
      message: `某个部分占比超过60%，建议平衡各部分比重`, 
      id: 'unbalanced-sections' 
    });
  }
  
  // Category balance check
  if (grammarPct > 70) {
    issues.push({ type: 'info', message: '语法题占比较高，可考虑增加其他类型题目', id: 'grammar-heavy' });
  }
  if (vocabPct > 70) {
    issues.push({ type: 'info', message: '词汇题占比较高，可考虑增加其他类型题目', id: 'vocab-heavy' });
  }
  if (readingPct > 70) {
    issues.push({ type: 'info', message: '阅读题占比较高，可考虑增加其他类型题目', id: 'reading-heavy' });
  }
  
  return {
    grammarPct,
    vocabPct,
    readingPct,
    otherPct,
    totalQuestions,
    totalScore,
    averagePointsPerQuestion,
    sectionAnalysis,
    typeDistribution,
    levelDistribution,
    hierarchy,
    issues,
  };
}
