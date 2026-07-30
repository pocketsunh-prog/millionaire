// HK DSE Mathematics (數學科) - 100 Multiple Choice Questions
// Difficulty distribution: 35 easy, 35 medium, 30 hard

const mathsQuestions = [
  // ==================== EASY (35 questions) ====================

  // Algebra Easy (1-6)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Solve 2x + 5 = 17.',
    option_a: 'x = 4',
    option_b: 'x = 5',
    option_c: 'x = 6',
    option_d: 'x = 7',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'If 3(x - 2) = 2x + 1, find x.',
    option_a: 'x = 3',
    option_b: 'x = 5',
    option_c: 'x = 7',
    option_d: 'x = 9',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Simplify 3x + 2y - x + 5y.',
    option_a: '2x + 7y',
    option_b: '4x + 7y',
    option_c: '2x + 3y',
    option_d: '4x + 3y',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Factorise x² - 9.',
    option_a: '(x - 3)(x - 3)',
    option_b: '(x + 3)(x - 3)',
    option_c: '(x + 9)(x - 1)',
    option_d: '(x + 1)(x - 9)',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'If f(x) = 2x - 3, find f(-2).',
    option_a: '-7',
    option_b: '-1',
    option_c: '1',
    option_d: '7',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Solve the inequality 3x - 7 > 8.',
    option_a: 'x > 3',
    option_b: 'x > 5',
    option_c: 'x < 5',
    option_d: 'x > 6',
    correct_answer: 'B'
  },

  // Geometry Easy (7-11)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'The interior angles of a triangle are in the ratio 1:2:3. Find the largest angle.',
    option_a: '30°',
    option_b: '60°',
    option_c: '90°',
    option_d: '120°',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the area of a circle with radius 7 cm. (Take π = 22/7)',
    option_a: '44 cm²',
    option_b: '154 cm²',
    option_c: '308 cm²',
    option_d: '22 cm²',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the distance between points A(1, 2) and B(4, 6).',
    option_a: '4',
    option_b: '5',
    option_c: '6',
    option_d: '√13',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'The angles of a quadrilateral are x, 2x, 3x and 4x. Find the largest angle.',
    option_a: '108°',
    option_b: '120°',
    option_c: '144°',
    option_d: '150°',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'A right-angled triangle has legs of length 3 and 4. Find the hypotenuse.',
    option_a: '5',
    option_b: '6',
    option_c: '7',
    option_d: '√7',
    correct_answer: 'A'
  },

  // Trigonometry Easy (12-16)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find sin 30°.',
    option_a: '1/2',
    option_b: '√3/2',
    option_c: '√2/2',
    option_d: '1',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'If sin θ = 3/5 and θ is acute, find cos θ.',
    option_a: '4/5',
    option_b: '3/4',
    option_c: '5/4',
    option_d: '1/2',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find tan 45°.',
    option_a: '0',
    option_b: '1',
    option_c: '√3',
    option_d: '1/√3',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Simplify sin²θ + cos²θ.',
    option_a: '0',
    option_b: '1',
    option_c: 'tan θ',
    option_d: 'sin 2θ',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find cos 60°.',
    option_a: '1/2',
    option_b: '√3/2',
    option_c: '√2/2',
    option_d: '1/√3',
    correct_answer: 'A'
  },

  // Calculus Easy (17-20)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find dy/dx if y = 3x².',
    option_a: '3x',
    option_b: '6x',
    option_c: '6x²',
    option_d: '3x²',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find ∫ 4x³ dx.',
    option_a: 'x⁴',
    option_b: 'x⁴ + C',
    option_c: '12x² + C',
    option_d: '4x⁴ + C',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find ∫₀² 3x² dx.',
    option_a: '6',
    option_b: '8',
    option_c: '12',
    option_d: '24',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the slope of the tangent to y = x² at x = 3.',
    option_a: '3',
    option_b: '6',
    option_c: '9',
    option_d: '12',
    correct_answer: 'B'
  },

  // Probability & Statistics Easy (21-24)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'A fair die is rolled. Find the probability of getting an even number.',
    option_a: '1/6',
    option_b: '1/3',
    option_c: '1/2',
    option_d: '2/3',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the mean of 2, 4, 6, 8, 10.',
    option_a: '4',
    option_b: '5',
    option_c: '6',
    option_d: '7',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'How many ways can 4 different books be arranged on a shelf?',
    option_a: '12',
    option_b: '16',
    option_c: '24',
    option_d: '48',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'From a group of 7 students, how many ways can a committee of 3 be chosen?',
    option_a: '21',
    option_b: '35',
    option_c: '42',
    option_d: '210',
    correct_answer: 'B'
  },

  // Vectors Easy (25)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'If a = (3, 4), find |a|.',
    option_a: '5',
    option_b: '7',
    option_c: '12',
    option_d: '25',
    correct_answer: 'A'
  },

  // Logarithms Easy (26-27)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find log₂ 8.',
    option_a: '2',
    option_b: '3',
    option_c: '4',
    option_d: '1',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'If 2ˣ = 16, find x.',
    option_a: '2',
    option_b: '4',
    option_c: '8',
    option_d: '32',
    correct_answer: 'B'
  },

  // Number Theory Easy (28-29)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the HCF of 12 and 18.',
    option_a: '2',
    option_b: '3',
    option_c: '6',
    option_d: '36',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Which of the following is a prime number?',
    option_a: '21',
    option_b: '23',
    option_c: '25',
    option_d: '27',
    correct_answer: 'B'
  },

  // Mixed Easy (30-35)
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Express 45% as a fraction in simplest form.',
    option_a: '45/100',
    option_b: '9/20',
    option_c: '9/25',
    option_d: '45/10',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Simplify √50.',
    option_a: '5√2',
    option_b: '10√5',
    option_c: '2√25',
    option_d: '25√2',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the equation of the circle with centre at origin and radius 5.',
    option_a: 'x² + y² = 5',
    option_b: 'x² + y² = 10',
    option_c: 'x² + y² = 25',
    option_d: 'x² + y² = 50',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Find the interquartile range of the data: 2, 4, 6, 8, 10, 12, 14.',
    option_a: '6',
    option_b: '7',
    option_c: '8',
    option_d: '10',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Simplify (2³)(2⁴).',
    option_a: '2⁷',
    option_b: '2¹²',
    option_c: '4⁷',
    option_d: '4¹²',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'easy',
    question: 'Round 3.14159 to 2 decimal places.',
    option_a: '3.14',
    option_b: '3.15',
    option_c: '3.141',
    option_d: '3.142',
    correct_answer: 'A'
  },

  // ==================== MEDIUM (35 questions) ====================

  // Algebra Medium (36-42)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Solve x² - 5x + 6 = 0.',
    option_a: 'x = 2 or x = 3',
    option_b: 'x = -2 or x = -3',
    option_c: 'x = 1 or x = 6',
    option_d: 'x = -1 or x = -6',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If f(x) = x² - 4x + 1, find the minimum value of f(x).',
    option_a: '-5',
    option_b: '-3',
    option_c: '-1',
    option_d: '1',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find the range of values of x for which x² - x - 6 < 0.',
    option_a: '-2 < x < 3',
    option_b: '-3 < x < 2',
    option_c: 'x < -2 or x > 3',
    option_d: 'x < -3 or x > 2',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If (x - 2) is a factor of x³ - 3x² + ax - 8, find a.',
    option_a: 'a = 4',
    option_b: 'a = 5',
    option_c: 'a = 6',
    option_d: 'a = 7',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'The sum and product of the roots of x² + px + q = 0 are -4 and 3 respectively. Find p and q.',
    option_a: 'p = 4, q = 3',
    option_b: 'p = -4, q = 3',
    option_c: 'p = 4, q = -3',
    option_d: 'p = -4, q = -3',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If f(x) = (2x+1)/(x-3), find f⁻¹(5).',
    option_a: '14/3',
    option_b: '16/3',
    option_c: '5',
    option_d: '3',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'When x³ + ax² - 4x + 6 is divided by (x - 1), the remainder is 4. Find a.',
    option_a: 'a = 1',
    option_b: 'a = 2',
    option_c: 'a = 3',
    option_d: 'a = 4',
    correct_answer: 'A'
  },

  // Geometry Medium (43-48)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'O is the centre of the circle and ∠AOB = 80°. Find ∠ACB where C is on the circumference.',
    option_a: '20°',
    option_b: '40°',
    option_c: '80°',
    option_d: '160°',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find the equation of the straight line passing through (1, 3) and (3, 7).',
    option_a: 'y = x + 2',
    option_b: 'y = 2x + 1',
    option_c: 'y = 2x - 1',
    option_d: 'y = 3x',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'The area of a triangle with vertices (0,0), (4,0) and (0,3) is:',
    option_a: '5 sq. units',
    option_b: '6 sq. units',
    option_c: '7 sq. units',
    option_d: '12 sq. units',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'ABCD is a cyclic quadrilateral. If ∠A = 75°, find ∠C.',
    option_a: '75°',
    option_b: '90°',
    option_c: '105°',
    option_d: '115°',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find the slope of the line perpendicular to 2x + 3y = 6.',
    option_a: '-2/3',
    option_b: '2/3',
    option_c: '3/2',
    option_d: '-3/2',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'In triangle ABC, D and E are midpoints of AB and AC respectively. If BC = 12 cm, find DE.',
    option_a: '4 cm',
    option_b: '6 cm',
    option_c: '8 cm',
    option_d: '24 cm',
    correct_answer: 'B'
  },

  // Trigonometry Medium (49-54)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Solve 2 cos θ + 1 = 0 for 0° ≤ θ ≤ 360°.',
    option_a: 'θ = 120°',
    option_b: 'θ = 120° and 240°',
    option_c: 'θ = 60° and 300°',
    option_d: 'θ = 240°',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Simplify (1 - cos²θ)/sin θ.',
    option_a: 'sin θ',
    option_b: 'cos θ',
    option_c: 'tan θ',
    option_d: 'cot θ',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If sin x = 1/3 and x is acute, find sin 2x.',
    option_a: '2/3',
    option_b: '2√2/3',
    option_c: '4√2/9',
    option_d: '√2/3',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'The amplitude and period of y = 3 sin(2x) are:',
    option_a: 'amplitude 3, period 180°',
    option_b: 'amplitude 3, period 360°',
    option_c: 'amplitude 2, period 180°',
    option_d: 'amplitude 2, period 360°',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'In triangle ABC, a = 8, b = 6 and ∠C = 60°. Find c.',
    option_a: '2√13',
    option_b: '√52',
    option_c: '√28',
    option_d: '2√7',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If cos A = -3/5 and A is in quadrant II, find sin A.',
    option_a: '-4/5',
    option_b: '4/5',
    option_c: '3/5',
    option_d: '-3/5',
    correct_answer: 'B'
  },

  // Calculus Medium (55-59)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find dy/dx if y = x² sin x.',
    option_a: '2x sin x + x² cos x',
    option_b: '2x cos x',
    option_c: 'x² sin x + 2x cos x',
    option_d: '2x sin x - x² cos x',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find ∫ x√x dx.',
    option_a: '(2/5)x^(5/2) + C',
    option_b: '(1/2)x² + C',
    option_c: '(2/3)x^(3/2) + C',
    option_d: '(3/2)x^(3/2) + C',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find the minimum value of f(x) = x² - 4x + 7.',
    option_a: '2',
    option_b: '3',
    option_c: '5',
    option_d: '7',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If y = e^(3x), find dy/dx.',
    option_a: '3e^(3x)',
    option_b: 'e^(3x)',
    option_c: '3x e^(3x)',
    option_d: '3e^(x)',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find ∫ cos(2x) dx.',
    option_a: 'sin(2x) + C',
    option_b: '(1/2)sin(2x) + C',
    option_c: '2sin(2x) + C',
    option_d: '-sin(2x) + C',
    correct_answer: 'B'
  },

  // Probability & Statistics Medium (60-64)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Two dice are rolled. Find the probability that the sum is 7.',
    option_a: '1/6',
    option_b: '1/9',
    option_c: '1/12',
    option_d: '5/36',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'The standard deviation of a data set is 3. What is the variance?',
    option_a: '3',
    option_b: '6',
    option_c: '9',
    option_d: '√3',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'A box contains 4 white and 6 black balls. Two balls are drawn without replacement. Find the probability that both are white.',
    option_a: '2/15',
    option_b: '1/5',
    option_c: '4/25',
    option_d: '3/10',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'A fair coin is tossed 3 times. Find the probability of getting exactly 2 heads.',
    option_a: '1/8',
    option_b: '1/4',
    option_c: '3/8',
    option_d: '1/2',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find the number of terms in the arithmetic sequence 3, 7, 11, ..., 79.',
    option_a: '18',
    option_b: '19',
    option_c: '20',
    option_d: '21',
    correct_answer: 'C'
  },

  // Vectors Medium (65-66)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If a = (1, 2) and b = (3, -1), find the dot product a · b.',
    option_a: '1',
    option_b: '5',
    option_c: '-1',
    option_d: '7',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If u = (2, 1) and v = (k, 3) are perpendicular, find k.',
    option_a: '-3/2',
    option_b: '3/2',
    option_c: '-2/3',
    option_d: '2/3',
    correct_answer: 'A'
  },

  // Logarithms Medium (67-68)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Solve log₃(x + 1) = 2.',
    option_a: 'x = 7',
    option_b: 'x = 8',
    option_c: 'x = 9',
    option_d: 'x = 10',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Solve 3^(2x) = 81.',
    option_a: 'x = 1',
    option_b: 'x = 2',
    option_c: 'x = 3',
    option_d: 'x = 4',
    correct_answer: 'B'
  },

  // Number Theory Medium (69-70)
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'Find the sum to infinity of the geometric series 8 + 4 + 2 + 1 + ...',
    option_a: '12',
    option_b: '16',
    option_c: '20',
    option_d: '24',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'medium',
    question: 'If the quadratic equation x² + kx + 9 = 0 has real and equal roots, find k.',
    option_a: 'k = 6',
    option_b: 'k = -6',
    option_c: 'k = ±6',
    option_d: 'k = ±3',
    correct_answer: 'C'
  },

  // ==================== HARD (30 questions) ====================

  // Algebra Hard (71-75)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the real solution(s) of √(x+5) = x - 1.',
    option_a: 'x = 4',
    option_b: 'x = -1',
    option_c: 'x = 4 and x = -1',
    option_d: 'No real solution',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'If α and β are the roots of 2x² - 4x + 1 = 0, find α² + β².',
    option_a: '2',
    option_b: '3',
    option_c: '4',
    option_d: '5',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Solve |2x - 3| = |x + 6|.',
    option_a: 'x = -1 only',
    option_b: 'x = 9 only',
    option_c: 'x = -1 or x = 9',
    option_d: 'x = -1 or x = 3',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'The equation (k-1)x² + 2(k-1)x + 2 = 0 has equal real roots. Find the value(s) of k.',
    option_a: 'k = 1',
    option_b: 'k = 3',
    option_c: 'k = 1 or k = 3',
    option_d: 'k = 2',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Let f(x) = ax² + bx + c. If f(1) = 6, f(-1) = 2 and f(2) = 15, find a + b + c.',
    option_a: '4',
    option_b: '5',
    option_c: '6',
    option_d: '7',
    correct_answer: 'C'
  },

  // Geometry Hard (76-80)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the area of the triangle with vertices A(1,2), B(4,6) and C(7,3).',
    option_a: '10 sq. units',
    option_b: '21/2 sq. units',
    option_c: '12 sq. units',
    option_d: '15/2 sq. units',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the equation of the circle with centre (2, -1) and passing through (5, 3).',
    option_a: '(x-2)² + (y+1)² = 5',
    option_b: '(x-2)² + (y+1)² = 25',
    option_c: '(x+2)² + (y-1)² = 25',
    option_d: '(x-2)² + (y+1)² = 16',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'In triangle ABC, AB = 5, BC = 7 and CA = 8. Find cos∠ABC.',
    option_a: '1/7',
    option_b: '11/14',
    option_c: '1/2',
    option_d: '5/7',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Two circles with centres P and Q and radii 5 and 3 respectively touch externally. Find PQ.',
    option_a: '2',
    option_b: '5',
    option_c: '8',
    option_d: '15',
    correct_answer: 'C'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the coordinates of the reflection of point (3, 4) across the line y = 2x + 1.',
    option_a: '(3/5, 26/5)',
    option_b: '(-3/5, 26/5)',
    option_c: '(3/5, -26/5)',
    option_d: '(4, 3)',
    correct_answer: 'A'
  },

  // Trigonometry Hard (81-85)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Solve sin 2θ = cos θ for 0° ≤ θ ≤ 360°.',
    option_a: 'θ = 30°, 90°, 150°',
    option_b: 'θ = 30°, 90°, 150°, 270°',
    option_c: 'θ = 45°, 135°, 225°, 315°',
    option_d: 'θ = 60°, 120°, 240°, 300°',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'In triangle ABC, a = 5, b = 7 and c = 8. Find the area of triangle ABC.',
    option_a: '10√3',
    option_b: '15√3',
    option_c: '20√3',
    option_d: '5√3',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the maximum value of sin θ + cos θ.',
    option_a: '1',
    option_b: '√2',
    option_c: '2',
    option_d: '√3',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'If sin x + cos x = 1/2, find sin 2x.',
    option_a: '-3/4',
    option_b: '-1/4',
    option_c: '3/4',
    option_d: '1/4',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'In triangle ABC, ∠A = 45°, ∠B = 60° and BC = 6. Find AB.',
    option_a: '3√6',
    option_b: '3(√3 + 1)',
    option_c: '6√2',
    option_d: '3√2',
    correct_answer: 'B'
  },

  // Calculus Hard (86-90)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find dy/dx if y = x^x.',
    option_a: 'x^x(1 + ln x)',
    option_b: 'x^x ln x',
    option_c: 'x^(x-1)',
    option_d: 'x^x(1 - ln x)',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find ∫ x e^x dx.',
    option_a: 'e^x(x - 1) + C',
    option_b: 'e^x(x + 1) + C',
    option_c: 'x²e^x + C',
    option_d: 'xe^x + C',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'A particle moves with velocity v(t) = 3t² - 12t + 9 m/s. Find the total distance travelled in the first 4 seconds.',
    option_a: '8 m',
    option_b: '12 m',
    option_c: '16 m',
    option_d: '20 m',
    correct_answer: 'B'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find ∫₀^(π/2) sin²x dx.',
    option_a: 'π/4',
    option_b: 'π/2',
    option_c: '1',
    option_d: 'π/8',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the area bounded by y = x², the x-axis and the line x = 2.',
    option_a: '8',
    option_b: '8/3',
    option_c: '4',
    option_d: '16/3',
    correct_answer: 'B'
  },

  // Probability & Statistics Hard (91-94)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'The probability that Alice passes a test is 0.8 and Bob passes is 0.7. If they take the test independently, find the probability that exactly one of them passes.',
    option_a: '0.38',
    option_b: '0.56',
    option_c: '0.94',
    option_d: '0.24',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'A random variable X ~ N(50, 10²). Find P(X > 60).',
    option_a: '0.1587',
    option_b: '0.3413',
    option_c: '0.5000',
    option_d: '0.8413',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'A bag contains 5 red, 4 blue and 3 green balls. Three balls are drawn at random. Find the probability that all three are of different colours.',
    option_a: '3/11',
    option_b: '5/22',
    option_c: '6/55',
    option_d: '1/4',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'A binomial experiment has n = 10 trials and probability of success p = 0.3. Find P(X = 2).',
    option_a: '0.2335',
    option_b: '0.1211',
    option_c: '0.2668',
    option_d: '0.3828',
    correct_answer: 'A'
  },

  // Vectors Hard (95)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'If A = [[2, 1], [1, 2]], find the eigenvalues of A.',
    option_a: '1 and 3',
    option_b: '2 and 2',
    option_c: '0 and 4',
    option_d: '-1 and 5',
    correct_answer: 'A'
  },

  // Logarithms Hard (96-97)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Solve log₂(x) + log₂(x - 2) = 3.',
    option_a: 'x = 4',
    option_b: 'x = -2',
    option_c: 'x = 4 or x = -2',
    option_d: 'x = 8',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'If log₂ 3 = a and log₂ 5 = b, express log₂ 45 in terms of a and b.',
    option_a: '2a + b',
    option_b: 'a + 2b',
    option_c: '2a + 2b',
    option_d: 'a² + b',
    correct_answer: 'A'
  },

  // Number Theory Hard (98)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'Find the coefficient of x³ in the expansion of (1 + 2x)⁵.',
    option_a: '40',
    option_b: '60',
    option_c: '80',
    option_d: '100',
    correct_answer: 'C'
  },

  // Mixed Hard (99-100)
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'The roots of x² - 5x + 7 = 0 are α and β. Find the equation whose roots are α² and β².',
    option_a: 'x² - 11x + 49 = 0',
    option_b: 'x² - 25x + 49 = 0',
    option_c: 'x² - 11x + 14 = 0',
    option_d: 'x² - 10x + 49 = 0',
    correct_answer: 'A'
  },
  {
    category: 'Maths',
    difficulty: 'hard',
    question: 'If f(x) = (ax + b)/(cx + d) and f(f(x)) = x for all x ≠ -d/c, which relation must hold?',
    option_a: 'a + d = 0',
    option_b: 'a = d',
    option_c: 'b = c',
    option_d: 'a = -c',
    correct_answer: 'A'
  }
];

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = mathsQuestions;
}
