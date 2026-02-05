import { ExamPaper, Question, User } from '../types';

export interface AnalysisData {
  totalQuestions: number;
  totalScore: number;
  averagePointsPerQuestion: number;
  sectionAnalysis: Array<{
    sectionTitle: string;
    questionCount: number;
    totalPoints: number;
    percentage: number;
  }>;
  typeDistribution: Record<string, number>;
  levelDistribution: Record<string, number>;
  issues: Array<{ type: 'warning' | 'error' | 'info'; message: string; id: string }>;
}

export async function calculateExamAnalysis(params: {
  exam: ExamPaper;
  user: User;
  allQuestions: Question[];
}): Promise<AnalysisData> {
  const { exam, allQuestions } = params;
  
  // Calculate total questions and score
  let totalQuestions = 0;
  let totalScore = 0;
  const questionMap = new Map<string, Question>();
  
  allQuestions.forEach(q => questionMap.set(q.id, q));
  
  // Section analysis
  const sectionAnalysis = exam.sections.map(section => {
    const sectionQuestions = section.items.length;
    const sectionPoints = section.items.reduce((sum, item) => sum + item.points, 0);
    
    totalQuestions += sectionQuestions;
    totalScore += sectionPoints;
    
    return {
      sectionTitle: section.title,
      questionCount: sectionQuestions,
      totalPoints: sectionPoints,
      percentage: 0 // Will be calculated after total is known
    };
  });
  
  // Calculate percentages
  sectionAnalysis.forEach(section => {
    section.percentage = totalScore > 0 ? (section.totalPoints / totalScore) * 100 : 0;
  });
  
  // Type distribution
  const typeDistribution: Record<string, number> = {};
  exam.sections.forEach(section => {
    section.items.forEach(item => {
      const q = questionMap.get(item.questionId);
      if (q && q.type) {
        typeDistribution[q.type] = (typeDistribution[q.type] || 0) + 1;
      }
    });
  });
  
  // Level distribution
  const levelDistribution: Record<string, number> = {};
  exam.sections.forEach(section => {
    section.items.forEach(item => {
      const q = questionMap.get(item.questionId);
      if (q && q.level) {
        levelDistribution[q.level] = (levelDistribution[q.level] || 0) + 1;
      }
    });
  });
  
  // Generate issues/suggestions
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
  
  // Check for unbalanced sections
  const maxPercentage = Math.max(...sectionAnalysis.map(s => s.percentage));
  if (maxPercentage > 60 && exam.sections.length > 1) {
    issues.push({ 
      type: 'warning', 
      message: `某个部分占比超过60%，建议平衡各部分比重`, 
      id: 'unbalanced-sections' 
    });
  }
  
  return {
    totalQuestions,
    totalScore,
    averagePointsPerQuestion,
    sectionAnalysis,
    typeDistribution,
    levelDistribution,
    issues
  };
}
