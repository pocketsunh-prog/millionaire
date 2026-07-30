const fs = require('fs');

// Chinese questions from agent output
const chinese = [
  { category: "Chinese", difficulty: "easy", question: "下列哪一個詞語在文言文中常用來表示「你」？", option_a: "汝", option_b: "吾", option_c: "其", option_d: "之", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「學而時習之，不亦說乎」中的「說」字是什麼意思？", option_a: "高興", option_b: "說話", option_c: "解釋", option_d: "勸說", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「吾日三省吾身」中的「省」是什麼意思？", option_a: "反省", option_b: "節省", option_c: "省份", option_d: "省略", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「溫故而知新」中的「故」字是什麼意思？", option_a: "舊有的知識", option_b: "故意", option_c: "故事", option_d: "緣故", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「之」字在文言文中不可以用作以下哪種用法？", option_a: "代詞", option_b: "動詞", option_c: "副詞", option_d: "助詞", correct_answer: "C" },
  { category: "Chinese", difficulty: "easy", question: "《論語》是哪位思想家的言論記錄？", option_a: "孔子", option_b: "老子", option_c: "莊子", option_d: "孟子", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「白日依山盡，黃河入海流」的作者是誰？", option_a: "王之渙", option_b: "王維", option_c: "孟浩然", option_d: "王昌齡", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「桃花源記」的作者是誰？", option_a: "陶淵明", option_b: "王維", option_c: "孟浩然", option_d: "謝靈運", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "《史記》的作者是誰？", option_a: "司馬遷", option_b: "司馬光", option_c: "班固", option_d: "左丘明", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「師說」的作者是誰？", option_a: "韓愈", option_b: "柳宗元", option_c: "歐陽修", option_d: "蘇軾", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一種修辭手法是把事物當作人來描寫？", option_a: "擬人", option_b: "比喻", option_c: "排比", option_d: "對偶", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個是「比喻」修辭手法的別稱？", option_a: "譬喻", option_b: "比擬", option_c: "對比", option_d: "象徵", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「對偶」修辭的特點是什麼？", option_a: "字數相等，結構相同", option_b: "重複使用詞語", option_c: "誇張描述事物", option_d: "用具體代替抽象", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「排比」修辭的作用是什麼？", option_a: "增強語勢，加強表達效果", option_b: "使語言含蓄", option_c: "使文章簡短", option_d: "使內容模糊", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個是「誇張」修辭的例子？", option_a: "「飛流直下三千尺」", option_b: "「春眠不覺曉」", option_c: "「床前明月光」", option_d: "「白日依山盡」", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「破釜沉舟」這個成語與哪位歷史人物有關？", option_a: "項羽", option_b: "劉邦", option_c: "韓信", option_d: "張良", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個成語形容學習勤奮刻苦？", option_a: "懸樑刺股", option_b: "守株待兔", option_c: "刻舟求劍", option_d: "掩耳盜鈴", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個詞語常用來指代「故鄉」？", option_a: "桑梓", option_b: "杏林", option_c: "芹獻", option_d: "墨寶", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個詞語常用來指代「醫學界」？", option_a: "杏林", option_b: "杏壇", option_c: "桑梓", option_d: "翰墨", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「詩仙」是指哪位詩人？", option_a: "李白", option_b: "杜甫", option_c: "白居易", option_d: "王維", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「三人行，必有我師焉」出自哪部典籍？", option_a: "《論語》", option_b: "《孟子》", option_c: "《大學》", option_d: "《中庸》", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「水調歌頭」是什麼？", option_a: "詞牌名", option_b: "詩題", option_c: "曲牌名", option_d: "文章名", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「詩聖」是指哪位詩人？", option_a: "杜甫", option_b: "李白", option_c: "王維", option_d: "孟浩然", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「醉翁亭記」的作者是誰？", option_a: "歐陽修", option_b: "韓愈", option_c: "柳宗元", option_d: "蘇軾", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個成語與「勤奮學習」無關？", option_a: "守株待兔", option_b: "鑿壁偷光", option_c: "囊螢映雪", option_d: "懸樑刺股", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "「歲寒，然後知松柏之後凋也」出自哪部典籍？", option_a: "《論語》", option_b: "《老子》", option_c: "《莊子》", option_d: "《荀子》", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一種文體屬於「記敘文」？", option_a: "《背影》", option_b: "《勸學》", option_c: "《師說》", option_d: "《六國論》", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個是「反問」修辭的例子？", option_a: "「難道我們不應該努力嗎？」", option_b: "「你今天好嗎？」", option_c: "「這是什麼？」", option_d: "「他什麼時候來？」", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個成語形容「意志堅定，不可動搖」？", option_a: "堅貞不屈", option_b: "朝三暮四", option_c: "見異思遷", option_d: "三心二意", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "《孟子》一書主要記錄了哪位思想家的言論？", option_a: "孟子", option_b: "孔子", option_c: "老子", option_d: "莊子", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個是「設問」修辭的例子？", option_a: "「什麼是人生最大的財富？是健康。」", option_b: "「天空是藍色的。」", option_c: "「他跑得很快。」", option_d: "「花兒真美啊！」", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個是「借代」修辭的例子？", option_a: "「紅領巾」代指小學生", option_b: "「月亮像銀盤」", option_c: "「小鳥在唱歌」", option_d: "「花兒開了」", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一位是宋代詞人？", option_a: "蘇軾", option_b: "李白", option_c: "杜甫", option_d: "白居易", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一個詞語是「書信」的別稱？", option_a: "鴻雁", option_b: "杏林", option_c: "桃李", option_d: "桑梓", correct_answer: "A" },
  { category: "Chinese", difficulty: "easy", question: "下列哪一位是唐代詩人？", option_a: "李白", option_b: "蘇軾", option_c: "辛棄疾", option_d: "李清照", correct_answer: "A" }
];

fs.writeFileSync('D:/dev/millionaire/chinese_questions.js', JSON.stringify(chinese, null, 2));
console.log(`Saved ${chinese.length} Chinese questions`);
