const mysql = require('mysql2/promise');
require('dotenv').config();

const questions = [
  // Science (1-15)
  { category: 'Science', difficulty: 'easy', question: 'What is the chemical symbol for water?', option_a: 'H2O', option_b: 'CO2', option_c: 'O2', option_d: 'NaCl', correct_answer: 'A' },
  { category: 'Science', difficulty: 'easy', question: 'What planet is known as the Red Planet?', option_a: 'Venus', option_b: 'Mars', option_c: 'Jupiter', option_d: 'Saturn', correct_answer: 'B' },
  { category: 'Science', difficulty: 'easy', question: 'What is the largest organ in the human body?', option_a: 'Heart', option_b: 'Liver', option_c: 'Skin', option_d: 'Brain', correct_answer: 'C' },
  { category: 'Science', difficulty: 'easy', question: 'What gas do plants absorb from the atmosphere?', option_a: 'Oxygen', option_b: 'Nitrogen', option_c: 'Carbon Dioxide', option_d: 'Hydrogen', correct_answer: 'C' },
  { category: 'Science', difficulty: 'easy', question: 'How many bones are in the adult human body?', option_a: '186', option_b: '206', option_c: '226', option_d: '246', correct_answer: 'B' },
  { category: 'Science', difficulty: 'medium', question: 'What is the speed of light in a vacuum?', option_a: '299,792 km/s', option_b: '199,792 km/s', option_c: '399,792 km/s', option_d: '149,792 km/s', correct_answer: 'A' },
  { category: 'Science', difficulty: 'medium', question: 'What is the hardest natural substance on Earth?', option_a: 'Gold', option_b: 'Iron', option_c: 'Diamond', option_d: 'Platinum', correct_answer: 'C' },
  { category: 'Science', difficulty: 'medium', question: 'What element has the atomic number 1?', option_a: 'Helium', option_b: 'Hydrogen', option_c: 'Lithium', option_d: 'Carbon', correct_answer: 'B' },
  { category: 'Science', difficulty: 'medium', question: 'What is the powerhouse of the cell?', option_a: 'Nucleus', option_b: 'Ribosome', option_c: 'Mitochondria', option_d: 'Golgi apparatus', correct_answer: 'C' },
  { category: 'Science', difficulty: 'medium', question: 'What type of blood cells help fight infections?', option_a: 'Red blood cells', option_b: 'White blood cells', option_c: 'Platelets', option_d: 'Plasma', correct_answer: 'B' },
  { category: 'Science', difficulty: 'hard', question: 'What is the half-life of Carbon-14?', option_a: '2,730 years', option_b: '5,730 years', option_c: '8,730 years', option_d: '11,730 years', correct_answer: 'B' },
  { category: 'Science', difficulty: 'hard', question: 'What is the Chandrasekhar limit?', option_a: '1.4 solar masses', option_b: '2.4 solar masses', option_c: '3.4 solar masses', option_d: '4.4 solar masses', correct_answer: 'A' },
  { category: 'Science', difficulty: 'hard', question: 'Which subatomic particle has no electric charge?', option_a: 'Proton', option_b: 'Electron', option_c: 'Neutron', option_d: 'Positron', correct_answer: 'C' },
  { category: 'Science', difficulty: 'hard', question: 'What is the most abundant element in the universe?', option_a: 'Oxygen', option_b: 'Carbon', option_c: 'Helium', option_d: 'Hydrogen', correct_answer: 'D' },
  { category: 'Science', difficulty: 'hard', question: 'What is the Heisenberg Uncertainty Principle about?', option_a: 'Energy conservation', option_b: 'Position and momentum', option_c: 'Wave-particle duality', option_d: 'Quantum entanglement', correct_answer: 'B' },

  // History (16-30)
  { category: 'History', difficulty: 'easy', question: 'In which year did World War II end?', option_a: '1943', option_b: '1944', option_c: '1945', option_d: '1946', correct_answer: 'C' },
  { category: 'History', difficulty: 'easy', question: 'Who was the first President of the United States?', option_a: 'Thomas Jefferson', option_b: 'George Washington', option_c: 'John Adams', option_d: 'Benjamin Franklin', correct_answer: 'B' },
  { category: 'History', difficulty: 'easy', question: 'The Great Wall of China was primarily built to protect against which group?', option_a: 'Japanese', option_b: 'Koreans', option_c: 'Mongols', option_d: 'Indians', correct_answer: 'C' },
  { category: 'History', difficulty: 'easy', question: 'Which ancient civilization built the pyramids at Giza?', option_a: 'Romans', option_b: 'Greeks', option_c: 'Egyptians', option_d: 'Persians', correct_answer: 'C' },
  { category: 'History', difficulty: 'easy', question: 'Who discovered America in 1492?', option_a: 'Vasco da Gama', option_b: 'Christopher Columbus', option_c: 'Ferdinand Magellan', option_d: 'Amerigo Vespucci', correct_answer: 'B' },
  { category: 'History', difficulty: 'medium', question: 'The French Revolution began in which year?', option_a: '1776', option_b: '1789', option_c: '1799', option_d: '1804', correct_answer: 'B' },
  { category: 'History', difficulty: 'medium', question: 'Who was the British Prime Minister during most of World War II?', option_a: 'Neville Chamberlain', option_b: 'Winston Churchill', option_c: 'Clement Attlee', option_d: 'Anthony Eden', correct_answer: 'B' },
  { category: 'History', difficulty: 'medium', question: 'The Berlin Wall fell in which year?', option_a: '1987', option_b: '1988', option_c: '1989', option_d: '1990', correct_answer: 'C' },
  { category: 'History', difficulty: 'medium', question: 'Which empire was ruled by Genghis Khan?', option_a: 'Ottoman Empire', option_b: 'Roman Empire', option_c: 'Mongol Empire', option_d: 'Persian Empire', correct_answer: 'C' },
  { category: 'History', difficulty: 'medium', question: 'The Titanic sank in which year?', option_a: '1905', option_b: '1912', option_c: '1920', option_d: '1925', correct_answer: 'B' },
  { category: 'History', difficulty: 'hard', question: 'The Treaty of Westphalia ended which conflict?', option_a: 'Hundred Years War', option_b: 'Thirty Years War', option_c: 'Seven Years War', option_d: 'Napoleonic Wars', correct_answer: 'B' },
  { category: 'History', difficulty: 'hard', question: 'Who was the last Pharaoh of Ancient Egypt?', option_a: 'Nefertiti', option_b: 'Hatshepsut', option_c: 'Cleopatra VII', option_d: 'Ramesses II', correct_answer: 'C' },
  { category: 'History', difficulty: 'hard', question: 'The Magna Carta was signed in which year?', option_a: '1066', option_b: '1215', option_c: '1348', option_d: '1453', correct_answer: 'B' },
  { category: 'History', difficulty: 'hard', question: 'Which battle is considered the turning point of the American Civil War?', option_a: 'Antietam', option_b: 'Bull Run', option_c: 'Gettysburg', option_d: 'Vicksburg', correct_answer: 'C' },
  { category: 'History', difficulty: 'hard', question: 'The Rosetta Stone helped decipher which writing system?', option_a: 'Cuneiform', option_b: 'Hieroglyphics', option_c: 'Linear B', option_d: 'Sanskrit', correct_answer: 'B' },

  // Geography (31-45)
  { category: 'Geography', difficulty: 'easy', question: 'What is the capital of France?', option_a: 'London', option_b: 'Berlin', option_c: 'Paris', option_d: 'Madrid', correct_answer: 'C' },
  { category: 'Geography', difficulty: 'easy', question: 'Which is the largest ocean on Earth?', option_a: 'Atlantic', option_b: 'Indian', option_c: 'Arctic', option_d: 'Pacific', correct_answer: 'D' },
  { category: 'Geography', difficulty: 'easy', question: 'What is the longest river in the world?', option_a: 'Amazon', option_b: 'Nile', option_c: 'Yangtze', option_d: 'Mississippi', correct_answer: 'B' },
  { category: 'Geography', difficulty: 'easy', question: 'Which continent is the Sahara Desert located on?', option_a: 'Asia', option_b: 'South America', option_c: 'Africa', option_d: 'Australia', correct_answer: 'C' },
  { category: 'Geography', difficulty: 'easy', question: 'What is the capital of Japan?', option_a: 'Seoul', option_b: 'Beijing', option_c: 'Tokyo', option_d: 'Bangkok', correct_answer: 'C' },
  { category: 'Geography', difficulty: 'medium', question: 'Which country has the most natural lakes?', option_a: 'USA', option_b: 'Canada', option_c: 'Russia', option_d: 'Finland', correct_answer: 'B' },
  { category: 'Geography', difficulty: 'medium', question: 'What is the smallest country in the world?', option_a: 'Monaco', option_b: 'Vatican City', option_c: 'San Marino', option_d: 'Liechtenstein', correct_answer: 'B' },
  { category: 'Geography', difficulty: 'medium', question: 'Mount Everest is located in which mountain range?', option_a: 'Andes', option_b: 'Alps', option_c: 'Himalayas', option_d: 'Rocky Mountains', correct_answer: 'C' },
  { category: 'Geography', difficulty: 'medium', question: 'Which country is both in Europe and Asia?', option_a: 'Greece', option_b: 'Turkey', option_c: 'Egypt', option_d: 'All of the above', correct_answer: 'D' },
  { category: 'Geography', difficulty: 'medium', question: 'What is the capital of Australia?', option_a: 'Sydney', option_b: 'Melbourne', option_c: 'Canberra', option_d: 'Perth', correct_answer: 'C' },
  { category: 'Geography', difficulty: 'hard', question: 'What is the deepest point in the ocean?', option_a: 'Puerto Rico Trench', option_b: 'Mariana Trench', option_c: 'Java Trench', option_d: 'Philippine Trench', correct_answer: 'B' },
  { category: 'Geography', difficulty: 'hard', question: 'Which African country has the largest population?', option_a: 'Egypt', option_b: 'Ethiopia', option_c: 'Nigeria', option_d: 'South Africa', correct_answer: 'C' },
  { category: 'Geography', difficulty: 'hard', question: 'What is the driest desert in the world?', option_a: 'Sahara', option_b: 'Gobi', option_c: 'Atacama', option_d: 'Antarctic', correct_answer: 'D' },
  { category: 'Geography', difficulty: 'hard', question: 'Which strait separates Europe from Africa?', option_a: 'Bosphorus', option_b: 'Gibraltar', option_c: 'Bering', option_d: 'Malacca', correct_answer: 'B' },
  { category: 'Geography', difficulty: 'hard', question: 'What is the most populous city in the world?', option_a: 'Tokyo', option_b: 'Delhi', option_c: 'Shanghai', option_d: 'São Paulo', correct_answer: 'A' },

  // Entertainment (46-60)
  { category: 'Entertainment', difficulty: 'easy', question: 'Who played Jack in the movie Titanic?', option_a: 'Brad Pitt', option_b: 'Johnny Depp', option_c: 'Leonardo DiCaprio', option_d: 'Tom Cruise', correct_answer: 'C' },
  { category: 'Entertainment', difficulty: 'easy', question: 'What is the name of Harry Potter\'s school?', option_a: 'Durmstrang', option_b: 'Beauxbatons', option_c: 'Hogwarts', option_d: 'Ilvermorny', correct_answer: 'C' },
  { category: 'Entertainment', difficulty: 'easy', question: 'Which band sang "Bohemian Rhapsody"?', option_a: 'The Beatles', option_b: 'Queen', option_c: 'Led Zeppelin', option_d: 'Pink Floyd', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'easy', question: 'What color is Mickey Mouse\'s shorts?', option_a: 'Blue', option_b: 'Green', option_c: 'Red', option_d: 'Yellow', correct_answer: 'C' },
  { category: 'Entertainment', difficulty: 'easy', question: 'Who is known as the "King of Pop"?', option_a: 'Elvis Presley', option_b: 'Michael Jackson', option_c: 'Prince', option_d: 'Freddie Mercury', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'medium', question: 'In which year was the first Star Wars film released?', option_a: '1975', option_b: '1977', option_c: '1979', option_d: '1980', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'medium', question: 'Who directed Jurassic Park?', option_a: 'James Cameron', option_b: 'Steven Spielberg', option_c: 'George Lucas', option_d: 'Ridley Scott', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'medium', question: 'What is the highest-grossing film of all time (not adjusted)?', option_a: 'Titanic', option_b: 'Avatar', option_c: 'Avengers: Endgame', option_d: 'Star Wars: The Force Awakens', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'medium', question: 'Which TV show features a character named Walter White?', option_a: 'The Wire', option_b: 'Breaking Bad', option_c: 'Better Call Saul', option_d: 'Dexter', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'medium', question: 'Who wrote the "Game of Thrones" book series?', option_a: 'J.K. Rowling', option_b: 'George R.R. Martin', option_c: 'Stephen King', option_d: 'J.R.R. Tolkien', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'hard', question: 'What was the first feature-length animated film ever released?', option_a: 'Fantasia', option_b: 'Snow White and the Seven Dwarfs', option_c: 'Pinocchio', option_d: 'Bambi', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'hard', question: 'Which artist has won the most Grammy Awards?', option_a: 'Beyoncé', option_b: 'Georg Solti', option_c: 'Quincy Jones', option_d: 'Stevie Wonder', correct_answer: 'A' },
  { category: 'Entertainment', difficulty: 'hard', question: 'In The Matrix, what color pill does Neo take?', option_a: 'Blue', option_b: 'Red', option_c: 'Green', option_d: 'White', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'hard', question: 'What year was the first episode of The Simpsons aired?', option_a: '1987', option_b: '1989', option_c: '1991', option_d: '1993', correct_answer: 'B' },
  { category: 'Entertainment', difficulty: 'hard', question: 'Who composed the Four Seasons?', option_a: 'Mozart', option_b: 'Beethoven', option_c: 'Vivaldi', option_d: 'Bach', correct_answer: 'C' },

  // Sports (61-75)
  { category: 'Sports', difficulty: 'easy', question: 'How many players are on a soccer team on the field?', option_a: '9', option_b: '10', option_c: '11', option_d: '12', correct_answer: 'C' },
  { category: 'Sports', difficulty: 'easy', question: 'In which sport would you perform a slam dunk?', option_a: 'Volleyball', option_b: 'Basketball', option_c: 'Tennis', option_d: 'Baseball', correct_answer: 'B' },
  { category: 'Sports', difficulty: 'easy', question: 'Which country hosted the 2016 Summer Olympics?', option_a: 'China', option_b: 'UK', option_c: 'Brazil', option_d: 'Japan', correct_answer: 'C' },
  { category: 'Sports', difficulty: 'easy', question: 'What color are the goalposts in American football?', option_a: 'White', option_b: 'Yellow', option_c: 'Red', option_d: 'Blue', correct_answer: 'B' },
  { category: 'Sports', difficulty: 'easy', question: 'Which sport is played at Wimbledon?', option_a: 'Cricket', option_b: 'Golf', option_c: 'Tennis', option_d: 'Rugby', correct_answer: 'C' },
  { category: 'Sports', difficulty: 'medium', question: 'Who holds the record for most home runs in MLB history?', option_a: 'Babe Ruth', option_b: 'Hank Aaron', option_c: 'Barry Bonds', option_d: 'Willie Mays', correct_answer: 'C' },
  { category: 'Sports', difficulty: 'medium', question: 'In which year were the first modern Olympic Games held?', option_a: '1892', option_b: '1896', option_c: '1900', option_d: '1904', correct_answer: 'B' },
  { category: 'Sports', difficulty: 'medium', question: 'Which country has won the most FIFA World Cups?', option_a: 'Germany', option_b: 'Argentina', option_c: 'Italy', option_d: 'Brazil', correct_answer: 'D' },
  { category: 'Sports', difficulty: 'medium', question: 'How many Grand Slam tennis tournaments are there?', option_a: '3', option_b: '4', option_c: '5', option_d: '6', correct_answer: 'B' },
  { category: 'Sports', difficulty: 'medium', question: 'What is the diameter of a basketball hoop in inches?', option_a: '16 inches', option_b: '18 inches', option_c: '20 inches', option_d: '22 inches', correct_answer: 'B' },
  { category: 'Sports', difficulty: 'hard', question: 'Who was the first woman to run a sub-2 hour marathon?', option_a: 'Paula Radcliffe', option_b: 'Mary Keitany', option_c: 'Brigid Kosgei', option_d: 'No woman has done it', correct_answer: 'D' },
  { category: 'Sports', difficulty: 'hard', question: 'In which year was the first Tour de France held?', option_a: '1899', option_b: '1901', option_c: '1903', option_d: '1905', correct_answer: 'C' },
  { category: 'Sports', difficulty: 'hard', question: 'Which boxer was known as "The Greatest"?', option_a: 'Mike Tyson', option_b: 'Muhammad Ali', option_c: 'Floyd Mayweather', option_d: 'Joe Louis', correct_answer: 'B' },
  { category: 'Sports', difficulty: 'hard', question: 'What is the only country to have played in every FIFA World Cup?', option_a: 'Germany', option_b: 'Argentina', option_c: 'Brazil', option_d: 'Italy', correct_answer: 'C' },
  { category: 'Sports', difficulty: 'hard', question: 'How many dimples does a standard golf ball have?', option_a: '250-300', option_b: '300-400', option_c: '400-500', option_d: '500-600', correct_answer: 'B' },

  // Technology (76-85)
  { category: 'Technology', difficulty: 'easy', question: 'What does "HTML" stand for?', option_a: 'Hyper Text Markup Language', option_b: 'High Tech Modern Language', option_c: 'Hyper Transfer Markup Language', option_d: 'Home Tool Markup Language', correct_answer: 'A' },
  { category: 'Technology', difficulty: 'easy', question: 'Who co-founded Microsoft?', option_a: 'Steve Jobs', option_b: 'Bill Gates', option_c: 'Mark Zuckerberg', option_d: 'Jeff Bezos', correct_answer: 'B' },
  { category: 'Technology', difficulty: 'easy', question: 'What does CPU stand for?', option_a: 'Central Processing Unit', option_b: 'Computer Personal Unit', option_c: 'Central Program Utility', option_d: 'Computer Processing Unit', correct_answer: 'A' },
  { category: 'Technology', difficulty: 'easy', question: 'What company created the iPhone?', option_a: 'Google', option_b: 'Microsoft', option_c: 'Apple', option_d: 'Samsung', correct_answer: 'C' },
  { category: 'Technology', difficulty: 'medium', question: 'In what year was the first iPhone released?', option_a: '2005', option_b: '2006', option_c: '2007', option_d: '2008', correct_answer: 'C' },
  { category: 'Technology', difficulty: 'medium', question: 'What programming language was created by Guido van Rossum?', option_a: 'Java', option_b: 'Python', option_c: 'Ruby', option_d: 'C++', correct_answer: 'B' },
  { category: 'Technology', difficulty: 'medium', question: 'What does "URL" stand for?', option_a: 'Universal Resource Locator', option_b: 'Uniform Resource Locator', option_c: 'Universal Reference Link', option_d: 'Unified Resource Locator', correct_answer: 'B' },
  { category: 'Technology', difficulty: 'medium', question: 'Who is credited with inventing the World Wide Web?', option_a: 'Bill Gates', option_b: 'Steve Wozniak', option_c: 'Tim Berners-Lee', option_d: 'Vint Cerf', correct_answer: 'C' },
  { category: 'Technology', difficulty: 'hard', question: 'What was the first programmable general-purpose computer?', option_a: 'ENIAC', option_b: 'Colossus', option_c: 'Z3', option_d: 'UNIVAC', correct_answer: 'A' },
  { category: 'Technology', difficulty: 'hard', question: 'What year was the first email sent?', option_a: '1969', option_b: '1971', option_c: '1973', option_d: '1975', correct_answer: 'B' },

  // Literature (86-95)
  { category: 'Literature', difficulty: 'easy', question: 'Who wrote "Romeo and Juliet"?', option_a: 'Charles Dickens', option_b: 'William Shakespeare', option_c: 'Jane Austen', option_d: 'Mark Twain', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'easy', question: 'What is the first book of the Bible?', option_a: 'Exodus', option_b: 'Leviticus', option_c: 'Genesis', option_d: 'Numbers', correct_answer: 'C' },
  { category: 'Literature', difficulty: 'medium', question: 'Who wrote "1984"?', option_a: 'Aldous Huxley', option_b: 'George Orwell', option_c: 'Ray Bradbury', option_d: 'H.G. Wells', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'medium', question: 'In which novel would you find the character Atticus Finch?', option_a: 'The Great Gatsby', option_b: 'To Kill a Mockingbird', option_c: 'Of Mice and Men', option_d: 'Catcher in the Rye', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'medium', question: 'Who wrote "The Great Gatsby"?', option_a: 'Ernest Hemingway', option_b: 'F. Scott Fitzgerald', option_c: 'John Steinbeck', option_d: 'William Faulkner', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'hard', question: 'What is the oldest surviving long poem in Old English?', option_a: 'The Canterbury Tales', option_b: 'Beowulf', option_c: 'Paradise Lost', option_d: 'The Iliad', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'hard', question: 'Who wrote "One Hundred Years of Solitude"?', option_a: 'Mario Vargas Llosa', option_b: 'Gabriel García Márquez', option_c: 'Jorge Luis Borges', option_d: 'Pablo Neruda', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'hard', question: 'What was the first novel ever written (widely considered)?', option_a: 'Don Quixote', option_b: 'The Tale of Genji', option_c: 'Canterbury Tales', option_d: 'Pride and Prejudice', correct_answer: 'B' },
  { category: 'Literature', difficulty: 'hard', question: 'Who wrote "The Divine Comedy"?', option_a: 'Petrarch', option_b: 'Boccaccio', option_c: 'Dante Alighieri', option_d: 'Machiavelli', correct_answer: 'C' },
  { category: 'Literature', difficulty: 'hard', question: 'In which language was "War and Peace" originally written?', option_a: 'French', option_b: 'German', option_c: 'Russian', option_d: 'English', correct_answer: 'C' },

  // General Knowledge (96-100)
  { category: 'General Knowledge', difficulty: 'easy', question: 'How many days are in a leap year?', option_a: '364', option_b: '365', option_c: '366', option_d: '367', correct_answer: 'C' },
  { category: 'General Knowledge', difficulty: 'easy', question: 'What is the currency of the United Kingdom?', option_a: 'Euro', option_b: 'Dollar', option_c: 'Pound Sterling', option_d: 'Franc', correct_answer: 'C' },
  { category: 'General Knowledge', difficulty: 'medium', question: 'Which planet has the most moons?', option_a: 'Jupiter', option_b: 'Saturn', option_c: 'Uranus', option_d: 'Neptune', correct_answer: 'B' },
  { category: 'General Knowledge', difficulty: 'medium', question: 'What is the study of earthquakes called?', option_a: 'Geology', option_b: 'Meteorology', option_c: 'Seismology', option_d: 'Volcanology', correct_answer: 'C' },
  { category: 'General Knowledge', difficulty: 'hard', question: 'What is the only mammal capable of true flight?', option_a: 'Flying squirrel', option_b: 'Bat', option_c: 'Sugar glider', option_d: 'Colugo', correct_answer: 'B' },
];

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected to database. Seeding questions...');

  for (const q of questions) {
    const [categories] = await connection.execute(
      'SELECT id FROM categories WHERE name = ?',
      [q.category]
    );

    if (categories.length === 0) {
      console.warn(`Category "${q.category}" not found, skipping...`);
      continue;
    }

    const categoryId = categories[0].id;

    await connection.execute(
      `INSERT INTO questions (category_id, question, option_a, option_b, option_c, option_d, correct_answer, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.difficulty]
    );
  }

  console.log(`Seeded ${questions.length} questions successfully!`);
  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
