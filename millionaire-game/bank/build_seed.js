const fs = require('fs');
const path = require('path');

const QUESTION_DIR = 'D:/dev/millionaire';
const OUTPUT = 'D:/dev/millionaire/millionaire-game/db/seed.js';

// Read original questions from existing seed.js
const originalSeed = fs.readFileSync(
  'D:/dev/millionaire/millionaire-game/db/seed.js',
  'utf8'
);
const originalMatch = originalSeed.match(
  /const questions = \[([\s\S]*?)\];/
);
const originalQuestions = originalMatch ? originalMatch[1].trim() : '';

// Read new question files
const newFiles = [
  'chinese_questions.js',
  'english_questions.js',
  'maths_questions.js',
  'physics_questions.js',
  'questions_final.js',
  'biology_questions.js',
  'dse_ict_questions.js',
  'chin_history_questions.js',
  'history_questions.js',
];

function parseQuestionFile(content) {
  // Extract the array content
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  
  const arrayContent = content.substring(start + 1, end);
  
  // Use Function constructor to evaluate the array (handles single quotes)
  try {
    const fn = new Function('return [' + arrayContent + ']');
    return fn();
  } catch (e) {
    console.error('Parse error: ' + e.message);
    return [];
  }
}

let newQuestions = [];
for (const f of newFiles) {
  const filePath = path.join(QUESTION_DIR, f);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const entries = parseQuestionFile(content);
    newQuestions = newQuestions.concat(entries);
    console.log('Loaded ' + entries.length + ' questions from ' + f);
  } else {
    console.log('File not found: ' + f);
  }
}

console.log('Total new questions: ' + newQuestions.length);

// Group by category
var categories = ['Chinese', 'English', 'Maths', 'Physics', 'Chemistry', 'Biology', 'IS', 'Chin History', 'History'];

// Generate the new seed.js
var seedContent = "const mysql = require('mysql2/promise');\nrequire('dotenv').config();\n\nconst questions = [\n";
seedContent += originalQuestions;
seedContent += ",\n";

for (var i = 0; i < categories.length; i++) {
  var cat = categories[i];
  var catQuestions = newQuestions.filter(function(q) { return q.category === cat; });
  seedContent += '\n  // ' + cat + ' (' + catQuestions.length + ' questions)\n';
  for (var j = 0; j < catQuestions.length; j++) {
    seedContent += '  ' + JSON.stringify(catQuestions[j]) + ',\n';
  }
}

seedContent += "];\n\nasync function seed() {\n";
seedContent += "  const connection = await mysql.createConnection({\n";
seedContent += "    host: process.env.DB_HOST,\n";
seedContent += "    port: process.env.DB_PORT,\n";
seedContent += "    user: process.env.DB_USER,\n";
seedContent += "    password: process.env.DB_PASSWORD,\n";
seedContent += "    database: process.env.DB_NAME,\n";
seedContent += "  });\n\n";
seedContent += "  console.log('Connected to database. Seeding questions...');\n\n";
seedContent += "  for (const q of questions) {\n";
seedContent += "    const [categories] = await connection.execute(\n";
seedContent += "      'SELECT id FROM categories WHERE name = ?',\n";
seedContent += "      [q.category]\n";
seedContent += "    );\n\n";
seedContent += "    if (categories.length === 0) {\n";
seedContent += "      console.warn('Category \"' + q.category + '\" not found, skipping...');\n";
seedContent += "      continue;\n";
seedContent += "    }\n\n";
seedContent += "    const categoryId = categories[0].id;\n\n";
seedContent += "    await connection.execute(\n";
seedContent += "      'INSERT INTO questions (category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',\n";
seedContent += "      [categoryId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.difficulty]\n";
seedContent += "    );\n";
seedContent += "  }\n\n";
seedContent += "  console.log('Seeded ' + questions.length + ' questions successfully!');\n";
seedContent += "  await connection.end();\n";
seedContent += "}\n\n";
seedContent += "seed().catch(err => {\n";
seedContent += "  console.error('Seeding failed:', err);\n";
seedContent += "  process.exit(1);\n";
seedContent += "});\n";

fs.writeFileSync(OUTPUT, seedContent);
console.log('Seed file written to ' + OUTPUT);
