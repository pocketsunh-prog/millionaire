const fs = require('fs');
const path = require('path');

const QUESTION_DIR = 'D:/dev/millionaire';
const OUTPUT = 'D:/dev/millionaire/millionaire-game/db/seed.js';

// Read original questions from the original seed.js backup
const originalSeedPath = path.join(QUESTION_DIR, 'seed_original.js');
let originalQuestions = [];

if (fs.existsSync(originalSeedPath)) {
  const content = fs.readFileSync(originalSeedPath, 'utf8');
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start !== -1 && end !== -1) {
    const arrayContent = content.substring(start + 1, end);
    try {
      const fn = new Function('return [' + arrayContent + ']');
      originalQuestions = fn();
    } catch (e) {
      console.error('Error parsing original seed: ' + e.message);
    }
  }
}

console.log('Original questions: ' + originalQuestions.length);

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
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  const arrayContent = content.substring(start + 1, end);
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

// Combine all questions
const allQuestions = originalQuestions.concat(newQuestions);
console.log('Total questions (original + new): ' + allQuestions.length);

// Generate the new seed.js
let seedContent = "const mysql = require('mysql2/promise');\nrequire('dotenv').config();\n\nconst questions = [\n";

for (let i = 0; i < allQuestions.length; i++) {
  seedContent += '  ' + JSON.stringify(allQuestions[i]) + ',\n';
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
