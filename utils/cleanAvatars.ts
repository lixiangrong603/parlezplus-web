/**
 * 清理所有 localStorage 中的旧头像数据
 * 运行此脚本将删除所有用户和学生的 avatar 字段，让系统使用新的基于首字母的头像系统
 */

import { User, Classroom } from '../types';

const STORAGE_KEYS = {
  USERS: 'parlezplus_users',
  CLASSROOMS: 'parlezplus_classrooms',
};

/**
 * 清理用户表中的头像
 */
export const cleanUserAvatars = (): number => {
  const usersData = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!usersData) return 0;

  let users: User[] = JSON.parse(usersData);
  let cleanedCount = 0;

  users = users.map(user => {
    // 如果头像是 pravatar.cc 或者存在旧的头像，删除它
    if (user.avatar) {
      cleanedCount++;
      const { avatar, ...userWithoutAvatar } = user;
      return userWithoutAvatar;
    }
    return user;
  });

  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  return cleanedCount;
};

/**
 * 清理教室数据中学生的头像
 */
export const cleanClassroomAvatars = (): number => {
  const classroomsData = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
  if (!classroomsData) return 0;

  let classrooms: Classroom[] = JSON.parse(classroomsData);
  let cleanedCount = 0;

  classrooms = classrooms.map(classroom => {
    const students = classroom.students.map(student => {
      if (student.avatar) {
        cleanedCount++;
        const { avatar, ...studentWithoutAvatar } = student;
        return studentWithoutAvatar;
      }
      return student;
    });
    
    return { ...classroom, students };
  });

  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classrooms));
  return cleanedCount;
};

/**
 * 清理所有头像数据
 */
export const cleanAllAvatars = (): { users: number; students: number } => {
  const usersCleaned = cleanUserAvatars();
  const studentsCleaned = cleanClassroomAvatars();
  
  console.log(`✅ 清理完成！`);
  console.log(`   - 用户头像: ${usersCleaned} 条`);
  console.log(`   - 学生头像: ${studentsCleaned} 条`);
  console.log(`   - 现在所有头像将使用基于主题色的首字母圆圈`);
  
  return { users: usersCleaned, students: studentsCleaned };
};
