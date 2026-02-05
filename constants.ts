
import { MediaResource } from './types';

export const CURRENT_USER_ID = 'teacher_sophie';

// [FIX] 添加缺失的 DEFAULT_COVERS 常量，包含一些默认的封面图片 URL
export const DEFAULT_COVERS = [
  "https://picsum.photos/id/10/800/450",
  "https://picsum.photos/id/20/800/450",
  "https://picsum.photos/id/30/800/450",
  "https://picsum.photos/id/40/800/450",
  "https://picsum.photos/id/50/800/450",
];

export const MOCK_RESOURCES: MediaResource[] = [
  {
    id: 'resource-101',
    userId: CURRENT_USER_ID,
    channelId: 'default',
    title: "Le Petit Prince - Introduction",
    level: 'A2',
    coverImage: "https://picsum.photos/id/1018/800/450",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    backingTrackUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Tetris_theme.ogg", 
    isCompleted: true, // Marked as completed
    status: 'ready',
    createdAt: 1710000000000,
    transcript: [
      {
        id: 'seg-1',
        text: "Lorsque j'avais six ans j'ai vu, une fois, une magnifique image.",
        translation: "当我还只有六岁的时候，看到过一幅精彩的插画。",
        startTime: 0,
        endTime: 5.5,
        words: [
          { word: "Lorsque", startTime: 0, endTime: 0.5 },
          { word: "j'avais", startTime: 0.5, endTime: 1.2 },
          { word: "six", startTime: 1.2, endTime: 1.8 },
          { word: "ans", startTime: 1.8, endTime: 2.2 },
          { word: "j'ai", startTime: 2.2, endTime: 2.6 },
          { word: "vu", startTime: 2.6, endTime: 3.0 },
          { word: "une", startTime: 3.0, endTime: 3.3 },
          { word: "fois", startTime: 3.3, endTime: 3.8 },
          { word: "une", startTime: 4.0, endTime: 4.3 },
          { word: "magnifique", startTime: 4.3, endTime: 5.0 },
          { word: "image", startTime: 5.0, endTime: 5.5 },
        ]
      },
      {
        id: 'seg-2',
        text: "C'était dans un livre sur la Forêt Vierge qui s'appelait Histoires Vécues.",
        translation: "那是在一本描写原始森林的名叫《真实的故事》的书中。",
        startTime: 5.8,
        endTime: 10.2,
        words: [
          { word: "C'était", startTime: 5.8, endTime: 6.5 },
          { word: "dans", startTime: 6.5, endTime: 6.8 },
          { word: "un", startTime: 6.8, endTime: 7.0 },
          { word: "livre", startTime: 7.0, endTime: 7.5 },
          { word: "sur", startTime: 7.5, endTime: 7.8 },
          { word: "la", startTime: 7.8, endTime: 8.0 },
          { word: "Forêt", startTime: 8.0, endTime: 8.5 },
          { word: "Vierge", startTime: 8.5, endTime: 9.0 },
          { word: "qui", startTime: 9.0, endTime: 9.2 },
          { word: "s'appelait", startTime: 9.2, endTime: 9.8 },
          { word: "Histoires", startTime: 9.8, endTime: 10.0 },
          { word: "Vécues", startTime: 10.0, endTime: 10.2 },
        ]
      },
      {
        id: 'seg-3',
        text: "Ça représentait un serpent boa qui avalait un fauve.",
        translation: "画的是一条蟒蛇正在吞食一只大猛兽。",
        startTime: 10.5,
        endTime: 14.0,
        words: [
          { word: "Ça", startTime: 10.5, endTime: 10.8 },
          { word: "représentait", startTime: 10.8, endTime: 11.5 },
          { word: "un", startTime: 11.5, endTime: 11.7 },
          { word: "serpent", startTime: 11.7, endTime: 12.2 },
          { word: "boa", startTime: 12.2, endTime: 12.5 },
          { word: "qui", startTime: 12.5, endTime: 12.8 },
          { word: "avalait", startTime: 12.8, endTime: 13.4 },
          { word: "un", startTime: 13.4, endTime: 13.6 },
          { word: "fauve", startTime: 13.6, endTime: 14.0 },
        ]
      }
    ]
  },
  {
    id: 'resource-102',
    userId: CURRENT_USER_ID,
    channelId: 'default',
    title: "Voyage à Paris - Arrivée",
    level: 'A1',
    coverImage: "https://picsum.photos/id/1036/800/450",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    backingTrackUrl: "", 
    isCompleted: false,
    status: 'ready',
    createdAt: 1710000000000,
    transcript: [
      {
        id: 'seg-1',
        text: "Bonjour, je voudrais un billet pour Paris, s'il vous plaît.",
        translation: "你好，我想要一张去巴黎的票，谢谢。",
        startTime: 0,
        endTime: 4.0,
        words: [
          { word: "Bonjour", startTime: 0, endTime: 1.0 },
          { word: "je", startTime: 1.0, endTime: 1.2 },
          { word: "voudrais", startTime: 1.2, endTime: 1.8 },
          { word: "un", startTime: 1.8, endTime: 2.0 },
          { word: "billet", startTime: 2.0, endTime: 2.5 },
          { word: "pour", startTime: 2.5, endTime: 2.8 },
          { word: "Paris", startTime: 2.8, endTime: 3.3 },
          { word: "s'il", startTime: 3.3, endTime: 3.6 },
          { word: "vous", startTime: 3.6, endTime: 3.8 },
          { word: "plaît", startTime: 3.8, endTime: 4.0 },
        ]
      }
    ]
  },
  {
    id: 'resource-103',
    userId: CURRENT_USER_ID,
    channelId: 'default',
    title: "L'Étranger - Albert Camus",
    level: 'B2',
    coverImage: "https://picsum.photos/id/1040/800/450",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    backingTrackUrl: "", 
    isCompleted: false,
    status: 'ready',
    createdAt: 1710000000000,
    transcript: [
      {
        id: 'seg-1',
        text: "Aujourd'hui, maman est morte. Ou peut-être hier, je ne sais pas.",
        translation: "今天，妈妈死了。也许是昨天，我不知道。",
        startTime: 0,
        endTime: 6.0,
        words: [
          { word: "Aujourd'hui", startTime: 0, endTime: 1.0 },
          { word: "maman", startTime: 1.0, endTime: 1.8 },
          { word: "est", startTime: 1.8, endTime: 2.0 },
          { word: "morte", startTime: 2.0, endTime: 2.8 },
          { word: "Ou", startTime: 3.0, endTime: 3.2 },
          { word: "peut-être", startTime: 3.2, endTime: 3.8 },
          { word: "hier", startTime: 3.8, endTime: 4.5 },
          { word: "je", startTime: 4.5, endTime: 4.8 },
          { word: "ne", startTime: 4.8, endTime: 5.0 },
          { word: "sais", startTime: 5.0, endTime: 5.5 },
          { word: "pas", startTime: 5.5, endTime: 6.0 },
        ]
      }
    ]
  }
];

export const MOCK_RESOURCE = MOCK_RESOURCES[0];
