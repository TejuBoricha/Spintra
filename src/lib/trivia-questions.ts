export interface TriviaQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  category: "General Knowledge" | "Science & Nature" | "Geography" | "History" | "Pop Culture" | "Sports";
  difficulty: "easy" | "medium" | "hard";
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // Science & Nature
  {
    text: "What is the chemical symbol for Gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy"
  },
  {
    text: "How many bones are there in an adult human body?",
    options: ["106", "206", "306", "406"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy"
  },
  {
    text: "Which organelle is known as the powerhouse of the cell?",
    options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi Apparatus"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy"
  },
  {
    text: "Which gas makes up the majority of Earth's atmosphere?",
    options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "medium"
  },
  {
    text: "What is the approximate speed of light in a vacuum?",
    options: ["186,000 miles per second", "300,000 miles per second", "150,000 miles per second", "250,000 miles per second"],
    correctIndex: 0,
    category: "Science & Nature",
    difficulty: "medium"
  },
  {
    text: "Which planet in our solar system is the hottest?",
    options: ["Mercury", "Venus", "Mars", "Jupiter"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy"
  },
  {
    text: "What is the atomic number of Hydrogen?",
    options: ["1", "2", "3", "4"],
    correctIndex: 0,
    category: "Science & Nature",
    difficulty: "easy"
  },
  {
    text: "What type of electromagnetic radiation has the shortest wavelength?",
    options: ["X-rays", "Gamma rays", "Ultraviolet rays", "Radio waves"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "hard"
  },
  {
    text: "Which element is the most abundant in the Earth's crust by weight?",
    options: ["Silicon", "Iron", "Oxygen", "Aluminum"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "hard"
  },
  {
    text: "How many chambers are there in a human heart?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy"
  },

  // Geography
  {
    text: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Rome"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    text: "What is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy"
  },
  {
    text: "Which river is the longest in the world?",
    options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    text: "What is the smallest country in the world by land area?",
    options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    text: "Which desert is the largest hot desert in the world?",
    options: ["Gobi Desert", "Kalahari Desert", "Sahara Desert", "Arabian Desert"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    text: "What is the highest mountain peak in the world?",
    options: ["K2", "Mount Kilimanjaro", "Mount Everest", "Mount Denali"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    text: "Which country has the largest land area?",
    options: ["Canada", "China", "United States", "Russia"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy"
  },
  {
    text: "Which African country has the largest population?",
    options: ["Egypt", "Nigeria", "Ethiopia", "South Africa"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    text: "In which country is the tallest building, the Burj Khalifa, located?",
    options: ["Saudi Arabia", "Qatar", "United Arab Emirates", "Singapore"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    text: "Which European capital city is built on 14 islands?",
    options: ["Amsterdam", "Venice", "Stockholm", "Copenhagen"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard"
  },

  // History
  {
    text: "Who painted the Mona Lisa?",
    options: ["Vincent van Gogh", "Leonardo da Vinci", "Pablo Picasso", "Claude Monet"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "Who wrote the play 'Romeo and Juliet'?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "In which year did the Titanic sink?",
    options: ["1908", "1912", "1916", "1920"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    text: "Who was the first President of the United States?",
    options: ["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "Which ancient empire built the Colosseum in Rome?",
    options: ["Grecian Empire", "Roman Empire", "Byzantine Empire", "Egyptian Empire"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "Who was the first person to walk on the moon in 1969?",
    options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "In which year did World War II end?",
    options: ["1918", "1939", "1941", "1945"],
    correctIndex: 3,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "Who was the prime minister of Great Britain during most of World War II?",
    options: ["Neville Chamberlain", "Winston Churchill", "Clement Attlee", "Anthony Eden"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    text: "Which country gifted the Statue of Liberty to the United States in 1886?",
    options: ["Great Britain", "France", "Spain", "Germany"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    text: "What was the name of the first artificial Earth satellite, launched by the USSR in 1957?",
    options: ["Vostok 1", "Sputnik 1", "Soyuz 1", "Explorer 1"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium"
  },

  // Pop Culture
  {
    text: "Which film won the very first Academy Award for Best Picture?",
    options: ["Metropolis", "Sunrise", "Wings", "The Jazz Singer"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "hard"
  },
  {
    text: "How many members were in the legendary band The Beatles?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy"
  },
  {
    text: "Which streaming network produced the hit series 'Stranger Things'?",
    options: ["Hulu", "HBO Max", "Disney+", "Netflix"],
    correctIndex: 3,
    category: "Pop Culture",
    difficulty: "easy"
  },
  {
    text: "What is the name of the fictional kingdom in Disney's 'Frozen'?",
    options: ["Corona", "Arendelle", "DunBroch", "Genovia"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy"
  },
  {
    text: "Who played Jack Dawson in the 1997 film 'Titanic'?",
    options: ["Brad Pitt", "Johnny Depp", "Leonardo DiCaprio", "Matt Damon"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy"
  },
  {
    text: "Which pop singer is known as the 'King of Pop'?",
    options: ["Prince", "Elvis Presley", "Michael Jackson", "Freddie Mercury"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy"
  },
  {
    text: "What is the highest-grossing film of all time (unadjusted for inflation)?",
    options: ["Avengers: Endgame", "Avatar", "Titanic", "Star Wars: The Force Awakens"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "medium"
  },
  {
    text: "How many seasons of the popular sitcom 'Friends' were produced?",
    options: ["8", "9", "10", "12"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "medium"
  },
  {
    text: "Which Marvel superhero has a shield made of vibranium?",
    options: ["Iron Man", "Thor", "Captain America", "Black Panther"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy"
  },
  {
    text: "What is the name of the island where Jurassic Park is located?",
    options: ["Isla Nublar", "Isla Sorna", "Isla de la Juventud", "Isla Tortuga"],
    correctIndex: 0,
    category: "Pop Culture",
    difficulty: "hard"
  },

  // Sports
  {
    text: "How many players are on a standard soccer team on the field at one time?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    text: "Which country won the first FIFA World Cup in 1930?",
    options: ["Brazil", "Argentina", "Uruguay", "Italy"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "medium"
  },
  {
    text: "In which sport are the terms 'love', 'deuce', and 'service' used?",
    options: ["Badminton", "Tennis", "Table Tennis", "Squash"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    text: "Who holds the record for the most Olympic gold medals won in history?",
    options: ["Usain Bolt", "Larisa Latynina", "Michael Phelps", "Carl Lewis"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    text: "How many rings are there on the official Olympic flag?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    text: "Which NBA player is famously nicknamed 'Air Jordan'?",
    options: ["Kobe Bryant", "LeBron James", "Michael Jordan", "Shaquille O'Neal"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    text: "What are the two national sports of Canada?",
    options: ["Ice Hockey and Lacrosse", "Ice Hockey and Baseball", "Curling and Lacrosse", "Ice Hockey and Rugby"],
    correctIndex: 0,
    category: "Sports",
    difficulty: "hard"
  },
  {
    text: "How long is a standard marathon race in miles?",
    options: ["20 miles", "26.2 miles", "31 miles", "13.1 miles"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "medium"
  },
  {
    text: "In golf, what is the term for scoring one stroke under par on a hole?",
    options: ["Bogey", "Eagle", "Birdie", "Albatross"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    text: "Which country has won the most FIFA World Cups?",
    options: ["Germany", "Italy", "Argentina", "Brazil"],
    correctIndex: 3,
    category: "Sports",
    difficulty: "easy"
  }
];
