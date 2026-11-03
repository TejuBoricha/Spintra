export type TriviaCategory =
  | "General Knowledge"
  | "Science & Nature"
  | "Geography"
  | "History"
  | "Pop Culture"
  | "Sports"
  | "Technology"
  | "Arts & Literature";

export interface TriviaQuestion {
  id?: string;
  text: string;
  options: string[];
  correctIndex: number;
  category: TriviaCategory;
  difficulty: "easy" | "medium" | "hard";
  explanation?: string;
}

export const TRIVIA_CATEGORIES: TriviaCategory[] = [
  "General Knowledge",
  "Science & Nature",
  "Geography",
  "History",
  "Pop Culture",
  "Sports",
  "Technology",
  "Arts & Literature",
];

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // ==========================================
  // SCIENCE & NATURE
  // ==========================================
  {
    text: "What is the chemical symbol for Gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Au comes from the Latin word for gold, 'aurum', meaning shining dawn."
  },
  {
    text: "How many bones are there in an adult human body?",
    options: ["106", "206", "306", "406"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Humans are born with around 270 bones, but many fuse together as we grow into adults."
  },
  {
    text: "Which organelle is known as the powerhouse of the cell?",
    options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi Apparatus"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Mitochondria generate most of the chemical energy needed to power the cell's biochemical reactions (ATP)."
  },
  {
    text: "Which gas makes up the majority of Earth's atmosphere?",
    options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Nitrogen makes up roughly 78% of Earth's atmosphere, while oxygen makes up about 21%."
  },
  {
    text: "What is the approximate speed of light in a vacuum?",
    options: ["186,000 miles per second", "300,000 miles per second", "150,000 miles per second", "250,000 miles per second"],
    correctIndex: 0,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Light travels at roughly 186,282 miles per second (or approximately 299,792 kilometers per second)."
  },
  {
    text: "Which planet in our solar system is the hottest?",
    options: ["Mercury", "Venus", "Mars", "Jupiter"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Even though Mercury is closer to the Sun, Venus's dense carbon dioxide atmosphere traps extreme heat via the greenhouse effect."
  },
  {
    text: "What is the atomic number of Hydrogen?",
    options: ["1", "2", "3", "4"],
    correctIndex: 0,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Hydrogen is the simplest and lightest element on the periodic table, consisting of one proton and one electron."
  },
  {
    text: "What type of electromagnetic radiation has the shortest wavelength?",
    options: ["X-rays", "Gamma rays", "Ultraviolet rays", "Radio waves"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "hard",
    explanation: "Gamma rays have the shortest wavelengths and the highest energy in the electromagnetic spectrum."
  },
  {
    text: "Which element is the most abundant in the Earth's crust by weight?",
    options: ["Silicon", "Iron", "Oxygen", "Aluminum"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "hard",
    explanation: "Oxygen accounts for about 46.6% of the Earth's crust by weight, primarily bonded in silicate minerals."
  },
  {
    text: "How many chambers are there in a human heart?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The human heart has four chambers: two upper atria and two lower ventricles."
  },
  {
    text: "What is the only mammal capable of sustained true flight?",
    options: ["Flying Squirrel", "Bat", "Sugar Glider", "Colugo"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Bats are the only mammals capable of true, powered flight (others can only glide)."
  },
  {
    text: "What natural phenomenon is measured using the Richter scale?",
    options: ["Tornadoes", "Hurricanes", "Earthquakes", "Volcanic eruptions"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The Richter scale quantifies the energy released by earthquakes."
  },
  {
    text: "What is the largest living species of reptile on Earth?",
    options: ["Komodo Dragon", "Saltwater Crocodile", "Leatherback Sea Turtle", "Green Anaconda"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "The saltwater crocodile can grow over 20 feet (6 meters) long and weigh more than 2,200 pounds."
  },
  {
    text: "What is the hardest known natural mineral on Earth?",
    options: ["Quartz", "Topaz", "Corundum", "Diamond"],
    correctIndex: 3,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Diamond rates 10 out of 10 on the Mohs hardness scale."
  },
  {
    text: "What is the process by which green plants make food using sunlight?",
    options: ["Cellular Respiration", "Photosynthesis", "Transpiration", "Fermentation"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Plants use chlorophyll to convert sunlight, carbon dioxide, and water into glucose and oxygen."
  },
  {
    text: "What is the center of an atom called?",
    options: ["Electron", "Proton", "Nucleus", "Photon"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The nucleus sits at the center of an atom, containing protons and neutrons."
  },
  {
    text: "Which planet has the Great Red Spot, a massive persistent storm?",
    options: ["Mars", "Jupiter", "Saturn", "Neptune"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The Great Red Spot is an anticyclonic storm on Jupiter larger than the entire planet Earth."
  },
  {
    text: "At what temperature Celsius does water freeze at standard pressure?",
    options: ["-10°C", "0°C", "10°C", "32°C"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Water freezes at 0°C (which corresponds to 32°F) under standard atmospheric pressure."
  },
  {
    text: "Which blood type is considered the universal red cell donor?",
    options: ["A positive", "B negative", "AB positive", "O negative"],
    correctIndex: 3,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "O negative red blood cells lack A, B, and Rh antigens, meaning they can safely be transfused into any recipient."
  },
  {
    text: "What is the study of mushrooms and fungi called?",
    options: ["Botany", "Mycology", "Entomology", "Herpetology"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Mycology is the branch of biology dedicated to the study of fungi."
  },
  {
    text: "Which organ produces the hormone insulin in the human body?",
    options: ["Liver", "Kidney", "Pancreas", "Gallbladder"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Beta cells located within the islets of Langerhans in the pancreas produce insulin."
  },
  {
    text: "What is the largest internal organ in the human body?",
    options: ["Heart", "Liver", "Lungs", "Brain"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "The liver is the largest internal organ, weighing around 3 pounds (the skin is the largest organ overall)."
  },
  {
    text: "Which metal is liquid at room temperature?",
    options: ["Gallium", "Mercury", "Cesium", "Bromine"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Mercury (Hg) is the only metallic element that is liquid at standard temperature and pressure."
  },
  {
    text: "Approximately how old is the universe according to the Big Bang theory?",
    options: ["4.5 billion years", "9.8 billion years", "13.8 billion years", "20.1 billion years"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "hard",
    explanation: "Cosmological measurements from cosmic microwave background radiation date the universe to ~13.8 billion years."
  },
  {
    text: "What protective layer of Earth's atmosphere shields us from ultraviolet rays?",
    options: ["Ionosphere", "Ozone layer", "Troposphere", "Mesosphere"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The ozone layer (O3) in the stratosphere absorbs the majority of the sun's harmful ultraviolet (UV) radiation."
  },

  // ==========================================
  // GEOGRAPHY
  // ==========================================
  {
    text: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Rome"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "Paris has been the capital and cultural center of France for centuries."
  },
  {
    text: "What is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Pacific Ocean covers over 60 million square miles, larger than all of Earth's landmasses combined."
  },
  {
    text: "Which river is traditionally considered the longest in the world?",
    options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Nile River in northeast Africa flows for roughly 6,650 km (4,132 miles)."
  },
  {
    text: "What is the smallest country in the world by land area?",
    options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium",
    explanation: "Vatican City measures just 0.49 square kilometers (about 121 acres) completely enclosed within Rome, Italy."
  },
  {
    text: "Which desert is the largest hot desert in the world?",
    options: ["Gobi Desert", "Kalahari Desert", "Sahara Desert", "Arabian Desert"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Sahara Desert covers over 9 million square kilometers across Northern Africa."
  },
  {
    text: "What is the highest mountain peak in the world above sea level?",
    options: ["K2", "Mount Kilimanjaro", "Mount Everest", "Mount Denali"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "Mount Everest in the Himalayas stands at 8,848.86 meters (29,031.7 feet) above sea level."
  },
  {
    text: "Which country has the largest land area?",
    options: ["Canada", "China", "United States", "Russia"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy",
    explanation: "Russia spans eleven time zones and covers more than 17 million square kilometers."
  },
  {
    text: "Which African country has the largest population?",
    options: ["Egypt", "Nigeria", "Ethiopia", "South Africa"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "Nigeria has an estimated population exceeding 220 million people."
  },
  {
    text: "In which city is the tallest building, the Burj Khalifa, located?",
    options: ["Riyadh", "Doha", "Dubai", "Abu Dhabi"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium",
    explanation: "The Burj Khalifa stands 828 meters (2,717 feet) tall in Dubai, United Arab Emirates."
  },
  {
    text: "Which European capital city is built on 14 islands?",
    options: ["Amsterdam", "Venice", "Stockholm", "Copenhagen"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard",
    explanation: "Stockholm, the capital of Sweden, is situated across 14 islands connected by over 50 bridges."
  },
  {
    text: "What is the capital city of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium",
    explanation: "Canberra was chosen as a compromise site between rivals Sydney and Melbourne in 1908."
  },
  {
    text: "Which country has the most natural lakes in the world?",
    options: ["United States", "Finland", "Canada", "Russia"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard",
    explanation: "Canada contains more than half of the world's natural lakes, with an estimated 2 million lakes."
  },
  {
    text: "What is the capital of Japan?",
    options: ["Kyoto", "Osaka", "Tokyo", "Hiroshima"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "Tokyo became the official capital and imperial seat of Japan during the Meiji Restoration in 1868."
  },
  {
    text: "Which strait separates the continents of Europe and Africa?",
    options: ["Strait of Malacca", "Strait of Hormuz", "Strait of Gibraltar", "Bering Strait"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium",
    explanation: "The Strait of Gibraltar connects the Atlantic Ocean to the Mediterranean Sea and is only 8.9 miles wide at its narrowest point."
  },
  {
    text: "What is the currency of the United Kingdom?",
    options: ["Euro", "Pound Sterling", "Franc", "Krona"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "The British Pound Sterling (£) is one of the world's oldest currencies still in active use."
  },
  {
    text: "What is the largest island in the world (not classified as a continent)?",
    options: ["Madagascar", "Greenland", "New Guinea", "Borneo"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "Greenland covers over 2.16 million square kilometers, making it by far the world's largest island."
  },
  {
    text: "Which South American country has both an Atlantic and a Pacific coast?",
    options: ["Chile", "Peru", "Colombia", "Brazil"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard",
    explanation: "Colombia is the only nation in South America with coastlines bordering both the Pacific Ocean and the Caribbean Sea (Atlantic)."
  },
  {
    text: "Which country is home to the ancient rock-cut city of Petra?",
    options: ["Egypt", "Jordan", "Lebanon", "Syria"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "Petra, the rose-red city carved directly into sandstone cliff faces, is located in southwestern Jordan."
  },
  {
    text: "What is the deepest known location in Earth's oceans?",
    options: ["Java Trench", "Puerto Rico Trench", "Mariana Trench", "Tonga Trench"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "Challenger Deep within the Mariana Trench in the western Pacific plunges to roughly 10,994 meters (36,070 feet)."
  },
  {
    text: "Which US state has the longest coastline?",
    options: ["California", "Florida", "Hawaii", "Alaska"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "medium",
    explanation: "Alaska has 6,640 miles of coastline, which is more than all other 49 US states combined."
  },

  // ==========================================
  // HISTORY
  // ==========================================
  {
    text: "Who painted the Mona Lisa?",
    options: ["Vincent van Gogh", "Leonardo da Vinci", "Pablo Picasso", "Claude Monet"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Leonardo da Vinci began painting the famous portrait in Florence around 1503."
  },
  {
    text: "In which year did the Titanic sink after striking an iceberg?",
    options: ["1908", "1912", "1916", "1920"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium",
    explanation: "The RMS Titanic sank on April 15, 1912, during its maiden voyage across the Atlantic."
  },
  {
    text: "Who was the first President of the United States?",
    options: ["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy",
    explanation: "George Washington served as the first US president from 1789 to 1797."
  },
  {
    text: "Which ancient civilization constructed the Colosseum in Rome?",
    options: ["Greeks", "Romans", "Byzantines", "Etruscans"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Emperor Vespasian began construction of the Flavian Amphitheatre (Colosseum) in 72 AD."
  },
  {
    text: "Who was the first human to walk on the Moon in July 1969?",
    options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy",
    explanation: "Apollo 11 commander Neil Armstrong stepped onto the lunar surface declaring: 'That's one small step for man, one giant leap for mankind.'"
  },
  {
    text: "In which year did World War II officially end?",
    options: ["1918", "1939", "1941", "1945"],
    correctIndex: 3,
    category: "History",
    difficulty: "easy",
    explanation: "World War II concluded in 1945 following the surrender of Germany in May and Japan in September."
  },
  {
    text: "Who was the Prime Minister of the United Kingdom during most of World War II?",
    options: ["Neville Chamberlain", "Winston Churchill", "Clement Attlee", "Anthony Eden"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium",
    explanation: "Winston Churchill served as UK Prime Minister from May 1940 to July 1945."
  },
  {
    text: "Which country gifted the Statue of Liberty to the United States in 1886?",
    options: ["Great Britain", "France", "Spain", "Germany"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "France gave the monument as a gift commemorating the centennial of the US Declaration of Independence."
  },
  {
    text: "What was the name of the first artificial Earth satellite, launched in 1957?",
    options: ["Vostok 1", "Sputnik 1", "Soyuz 1", "Explorer 1"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium",
    explanation: "Sputnik 1 was launched by the Soviet Union on October 4, 1957, igniting the Space Race."
  },
  {
    text: "Who was the famous female Pharaoh of ancient Egypt known for her alliances with Julius Caesar and Mark Antony?",
    options: ["Nefertiti", "Hatshepsut", "Cleopatra VII", "Twosret"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy",
    explanation: "Cleopatra VII Philopator was the last active ruler of the Ptolemaic Kingdom of Egypt."
  },
  {
    text: "Which wall divided an iconic European city from 1961 to 1989?",
    options: ["Maginot Line", "Berlin Wall", "Hadrian's Wall", "Iron Curtain"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "The Berlin Wall was erected by East Germany in 1961 and fell on November 9, 1989."
  },
  {
    text: "What document was signed in England in 1215, establishing the principle that everyone is subject to the law?",
    options: ["Habeas Corpus", "Bill of Rights", "Magna Carta", "Treaty of Paris"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium",
    explanation: "King John granted the Magna Carta at Runnymede under pressure from rebellious English barons."
  },
  {
    text: "Which explorer led the expedition that first successfully circumnavigated the globe?",
    options: ["Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan", "James Cook"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium",
    explanation: "Magellan led the 1519 expedition; though Magellan was killed in the Philippines, his crew led by Juan Sebastián Elcano completed the journey."
  },
  {
    text: "Who was the leader of the Indian independence movement known for nonviolent resistance?",
    options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Subhas Chandra Bose", "Bhagat Singh"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Mahatma Gandhi pioneered satyagraha (peaceful civil resistance), inspiring freedom and civil rights movements globally."
  },
  {
    text: "In what year did the French Revolution begin with the storming of the Bastille?",
    options: ["1776", "1789", "1804", "1815"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium",
    explanation: "The storming of the royal fortress of the Bastille in Paris occurred on July 14, 1789."
  },
  {
    text: "Who was the legendary general who conquered the Persian Empire by the age of thirty?",
    options: ["Julius Caesar", "Alexander the Great", "Hannibal Barca", "Genghis Khan"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Alexander the Great of Macedon created one of history's largest empires stretching from Greece to northwestern India."
  },
  {
    text: "Which ancient wonder was located in Alexandria, Egypt and guided sailors safely into port?",
    options: ["Colossus of Rhodes", "Lighthouse of Alexandria", "Hanging Gardens", "Statue of Zeus"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "The Pharos of Alexandria was built in the 3rd century BC and stood over 100 meters tall."
  },
  {
    text: "What was the name of the trade route network connecting China with the Mediterranean world?",
    options: ["Amber Road", "Spice Route", "Silk Road", "Tea Horse Trail"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy",
    explanation: "The Silk Road facilitated trade of silk, spices, ideas, and technologies between the East and West for centuries."
  },
  {
    text: "Who was the primary author of the American Declaration of Independence in 1776?",
    options: ["John Adams", "Benjamin Franklin", "Thomas Jefferson", "Alexander Hamilton"],
    correctIndex: 2,
    category: "History",
    difficulty: "medium",
    explanation: "Thomas Jefferson drafted the Declaration, which was adopted by the Second Continental Congress on July 4, 1776."
  },
  {
    text: "Which Russian monarch founded the city of St. Petersburg in 1703?",
    options: ["Ivan the Terrible", "Peter the Great", "Catherine the Great", "Nicholas II"],
    correctIndex: 1,
    category: "History",
    difficulty: "hard",
    explanation: "Tsar Peter the Great founded St. Petersburg to serve as Russia's 'window to Europe'."
  },

  // ==========================================
  // GENERAL KNOWLEDGE
  // ==========================================
  {
    text: "Which language has the highest number of native speakers in the world?",
    options: ["English", "Spanish", "Mandarin Chinese", "Hindi"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Mandarin Chinese has over 900 million native speakers, surpassing Spanish and English."
  },
  {
    text: "What is the smallest prime number?",
    options: ["0", "1", "2", "3"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "2 is the smallest prime number and also the only even prime number."
  },
  {
    text: "How many dots are on a standard six-sided die in total?",
    options: ["18", "21", "24", "26"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "1 + 2 + 3 + 4 + 5 + 6 = 21 pips on a standard die."
  },
  {
    text: "How many degrees are in a full circle?",
    options: ["180°", "270°", "360°", "400°"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "A complete rotation around a circle encompasses 360 degrees."
  },
  {
    text: "What color do you get when you mix blue and yellow paint?",
    options: ["Green", "Purple", "Orange", "Brown"],
    correctIndex: 0,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "In subtractive color mixing, combining blue and yellow produces green."
  },
  {
    text: "How many cards are in a standard deck of playing cards (excluding jokers)?",
    options: ["48", "50", "52", "54"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "A standard deck has 52 cards divided into 4 suits of 13 ranks each."
  },
  {
    text: "Which letter is worth the most points in standard English Scrabble (10 points)?",
    options: ["J and K", "Q and Z", "X and Y", "V and W"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "Both Q and Z carry the maximum value of 10 points in the English edition of Scrabble."
  },
  {
    text: "What is the Roman numeral for 1,000?",
    options: ["C", "D", "M", "L"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "M represents 1,000 in Roman numerals (originating from Latin 'mille')."
  },
  {
    text: "How many days are there in a standard leap year?",
    options: ["364", "365", "366", "367"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "A leap year adds February 29th, bringing the total number of days to 366."
  },
  {
    text: "Which chess piece can only move diagonally?",
    options: ["Knight", "Bishop", "Rook", "Pawn"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Bishops move any number of squares diagonally and never change the square color they started on."
  },
  {
    text: "What is the traditional gift for a 50th wedding anniversary?",
    options: ["Silver", "Ruby", "Gold", "Diamond"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "A 50th anniversary is celebrated as the Golden Anniversary (25th is Silver, 60th is Diamond)."
  },
  {
    text: "How many zeroes are in the number one million?",
    options: ["5", "6", "7", "8"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "One million is written numerically as 1,000,000 (six zeros)."
  },
  {
    text: "Which primary color is directly opposite purple on the traditional color wheel?",
    options: ["Red", "Orange", "Yellow", "Green"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "Yellow and purple are complementary colors, sitting directly opposite each other on the color wheel."
  },
  {
    text: "What is the name of the international radio distress signal word?",
    options: ["Help", "SOS", "Mayday", "Pan-Pan"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "'Mayday' comes from the French phrase 'venez m'aider' meaning 'come and help me'."
  },
  {
    text: "How many time zones are used in mainland France (including overseas territories it holds the world record with 12)?",
    options: ["1", "2", "3", "4"],
    correctIndex: 0,
    category: "General Knowledge",
    difficulty: "hard",
    explanation: "Mainland (Metropolitan) France operates entirely within 1 time zone (Central European Time)."
  },
  {
    text: "What type of food is a Granny Smith?",
    options: ["Cheese", "Apple", "Potato", "Pear"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Granny Smith is a crisp, tart green apple cultivar originally propagated in Australia in 1868."
  },
  {
    text: "What unit is used to measure sound intensity and loudness?",
    options: ["Hertz", "Lumen", "Decibel", "Watt"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "The decibel (dB) is a logarithmic unit used to express the ratio of acoustic pressure or sound level."
  },
  {
    text: "In the NATO phonetic alphabet, which word represents the letter 'B'?",
    options: ["Baker", "Bravo", "Boston", "Beta"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "The standard sequence is Alfa, Bravo, Charlie, Delta, Echo, Foxtrot, etc."
  },
  {
    text: "How many sides does an octagon have?",
    options: ["6", "7", "8", "9"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "An octagon is an eight-sided polygon (standard stop signs are octagons)."
  },
  {
    text: "What is the most consumed beverage in the world after plain water?",
    options: ["Coffee", "Beer", "Tea", "Orange Juice"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "Tea is the second most consumed beverage globally, with billions of cups enjoyed daily."
  },

  // ==========================================
  // POP CULTURE & ENTERTAINMENT
  // ==========================================
  {
    text: "Which film won the very first Academy Award for Best Picture?",
    options: ["Metropolis", "Sunrise", "Wings", "The Jazz Singer"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "hard",
    explanation: "'Wings' (1927), a silent World War I aviation drama, won Outstanding Picture at the first Oscars in 1929."
  },
  {
    text: "How many members were in the legendary British rock band The Beatles?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "The 'Fab Four' consisted of John Lennon, Paul McCartney, George Harrison, and Ringo Starr."
  },
  {
    text: "Which streaming network produced the global hit sci-fi series 'Stranger Things'?",
    options: ["Hulu", "HBO Max", "Disney+", "Netflix"],
    correctIndex: 3,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "'Stranger Things', created by the Duffer Brothers, premiered on Netflix in July 2016."
  },
  {
    text: "What is the name of the fictional kingdom in Disney's animated movie 'Frozen'?",
    options: ["Corona", "Arendelle", "DunBroch", "Genovia"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Elsa and Anna rule over the Nordic-inspired kingdom of Arendelle."
  },
  {
    text: "Who played Jack Dawson in James Cameron's 1997 blockbuster film 'Titanic'?",
    options: ["Brad Pitt", "Johnny Depp", "Leonardo DiCaprio", "Matt Damon"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Leonardo DiCaprio starred alongside Kate Winslet (Rose DeWitt Bukater) in the romance epic."
  },
  {
    text: "Which iconic pop singer is universally known as the 'King of Pop'?",
    options: ["Prince", "Elvis Presley", "Michael Jackson", "Freddie Mercury"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Michael Jackson earned the moniker 'King of Pop' through groundbreaking albums like Thriller and Bad."
  },
  {
    text: "What is the highest-grossing film of all time worldwide (unadjusted for inflation)?",
    options: ["Avengers: Endgame", "Avatar", "Titanic", "Star Wars: The Force Awakens"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "medium",
    explanation: "James Cameron's 'Avatar' (2009) holds the top box-office record with over $2.9 billion in receipts."
  },
  {
    text: "How many seasons of the popular television sitcom 'Friends' were produced?",
    options: ["8", "9", "10", "12"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "medium",
    explanation: "'Friends' ran for exactly 10 seasons from 1994 to 2004 on NBC (236 episodes)."
  },
  {
    text: "Which Marvel superhero wields a star-spangled circular shield made of vibranium?",
    options: ["Iron Man", "Thor", "Captain America", "Black Panther"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Steve Rogers (Captain America) carries the iconic circular vibranium shield."
  },
  {
    text: "What is the name of the fictional island where the original Jurassic Park was built?",
    options: ["Isla Nublar", "Isla Sorna", "Isla Tortuga", "Isla de Muerta"],
    correctIndex: 0,
    category: "Pop Culture",
    difficulty: "hard",
    explanation: "John Hammond's original dinosaur theme park was built on Isla Nublar off the coast of Costa Rica."
  },
  {
    text: "Which artist released the best-selling album 'Thriller' in 1982?",
    options: ["Stevie Wonder", "Prince", "Michael Jackson", "Lionel Richie"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "'Thriller' has sold an estimated 70+ million copies worldwide, featuring hits like 'Billie Jean' and 'Beat It'."
  },
  {
    text: "What is the name of the coffee shop where the characters frequently gather in 'Friends'?",
    options: ["Central Perk", "Monk's Diner", "MacLaren's Pub", "The Daily Grind"],
    correctIndex: 0,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Central Perk in Greenwich Village is where Gunther served the gang for 10 seasons."
  },
  {
    text: "Who voiced the character of Woody in Pixar's groundbreaking 1995 film 'Toy Story'?",
    options: ["Tim Allen", "Tom Hanks", "Billy Crystal", "Robin Williams"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Tom Hanks provided the voice for the beloved pull-string cowboy doll Woody."
  },
  {
    text: "Which British fantasy book series features the wizarding sport of Quidditch?",
    options: ["The Chronicles of Narnia", "The Lord of the Rings", "Harry Potter", "His Dark Materials"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Quidditch is the broomstick sport invented by J.K. Rowling in the Harry Potter series."
  },
  {
    text: "Who played Iron Man / Tony Stark in the Marvel Cinematic Universe starting in 2008?",
    options: ["Chris Evans", "Robert Downey Jr.", "Mark Ruffalo", "Christian Bale"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Robert Downey Jr.'s portrayal launched the Marvel Cinematic Universe in 2008."
  },
  {
    text: "In 'Star Wars: A New Hope', what weapon does Obi-Wan Kenobi describe as 'an elegant weapon for a more civilized age'?",
    options: ["Blaster pistol", "Thermal detonator", "Lightsaber", "Bowcaster"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Obi-Wan presents Anakin's blue lightsaber to young Luke Skywalker."
  },
  {
    text: "Which singer is known by the nickname 'The Queen of Pop'?",
    options: ["Whitney Houston", "Madonna", "Beyoncé", "Celine Dion"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Madonna has been celebrated as the Queen of Pop since the 1980s."
  },
  {
    text: "In the animated show 'The Simpsons', what is Homer Simpson's favorite snack?",
    options: ["Pizza", "Doughnuts", "Tacos", "Hamburgers"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Homer's catchphrase 'Mmm... doughnuts' accompanied by pink-frosted sprinkles is iconic."
  },
  {
    text: "Which musical won 11 Tony Awards and a Pulitzer Prize for Drama in 2016?",
    options: ["Wicked", "Dear Evan Hansen", "Hamilton", "The Book of Mormon"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "medium",
    explanation: "Lin-Manuel Miranda created and starred in the hip-hop Broadway phenomenon 'Hamilton'."
  },
  {
    text: "What is the name of Mario's taller, green-capped brother in Nintendo video games?",
    options: ["Wario", "Luigi", "Toad", "Waluigi"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Luigi debuted in the 1983 Game & Watch title Mario Bros. as the second player."
  },

  // ==========================================
  // SPORTS & GAMES
  // ==========================================
  {
    text: "How many players are on the field for one soccer team during a match?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "A standard association football team fields 11 players, including one goalkeeper."
  },
  {
    text: "Which country won the very first FIFA World Cup tournament in 1930?",
    options: ["Brazil", "Argentina", "Uruguay", "Italy"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "medium",
    explanation: "Host nation Uruguay defeated Argentina 4-2 in Montevideo to win the inaugural 1930 World Cup."
  },
  {
    text: "In tennis, what score is represented by the term 'love'?",
    options: ["0", "15", "30", "40"],
    correctIndex: 0,
    category: "Sports",
    difficulty: "easy",
    explanation: "'Love' represents zero in tennis, thought to originate from the French word 'l'oeuf' (egg, resembling a zero)."
  },
  {
    text: "Who has won the most Olympic gold medals in history (23 golds)?",
    options: ["Usain Bolt", "Larisa Latynina", "Michael Phelps", "Carl Lewis"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "American swimmer Michael Phelps won 23 gold medals (and 28 total medals) across five Olympic Games."
  },
  {
    text: "How many rings are interlocked on the official Olympic flag?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "The 5 rings represent the five inhabited continents: Africa, the Americas, Asia, Europe, and Oceania."
  },
  {
    text: "Which NBA legend wore jersey number 23 for the Chicago Bulls?",
    options: ["Kobe Bryant", "LeBron James", "Michael Jordan", "Magic Johnson"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "Michael Jordan led the Chicago Bulls to six NBA championships in the 1990s."
  },
  {
    text: "What are the two official national sports of Canada?",
    options: ["Ice Hockey and Lacrosse", "Ice Hockey and Curling", "Curling and Lacrosse", "Ice Hockey and Baseball"],
    correctIndex: 0,
    category: "Sports",
    difficulty: "hard",
    explanation: "Canada officially designated Ice Hockey as its national winter sport and Lacrosse as its national summer sport."
  },
  {
    text: "How long is a standard marathon foot race?",
    options: ["20 miles", "26.2 miles", "30 miles", "13.1 miles"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "The standard marathon distance was standardized at 26 miles 385 yards (42.195 km) at the 1908 London Olympics."
  },
  {
    text: "In golf, what is the term for scoring one stroke below par on a hole?",
    options: ["Bogey", "Eagle", "Birdie", "Albatross"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "One stroke under par is a Birdie, two under is an Eagle, and one over is a Bogey."
  },
  {
    text: "Which nation has won the most men's FIFA World Cups (5 titles)?",
    options: ["Germany", "Italy", "Argentina", "Brazil"],
    correctIndex: 3,
    category: "Sports",
    difficulty: "easy",
    explanation: "Brazil has won 5 FIFA World Cups (1958, 1962, 1970, 1994, and 2002)."
  },
  {
    text: "In bowling, what is the term for rolling three consecutive strikes?",
    options: ["Hat trick", "Turkey", "Triple crown", "Spare"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "medium",
    explanation: "Rolling three consecutive strikes in ten-pin bowling is traditionally called a 'turkey'."
  },
  {
    text: "How many points is a touchdown worth in American football (before extra points)?",
    options: ["3", "6", "7", "8"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "A touchdown is worth 6 points, followed by a field goal try (1 pt) or two-point conversion."
  },
  {
    text: "Which country is credited with inventing modern table tennis (ping-pong)?",
    options: ["China", "England", "Japan", "Sweden"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "medium",
    explanation: "Table tennis originated in Victorian England in the late 19th century as an after-dinner parlour game."
  },
  {
    text: "How many players are on the court for one basketball team during play?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "Each basketball team fields 5 active players on the court."
  },
  {
    text: "Which Jamaican sprinter holds the world record for both the 100m (9.58s) and 200m (19.19s)?",
    options: ["Tyson Gay", "Yohan Blake", "Usain Bolt", "Asafa Powell"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "Usain Bolt set both electric sprint world records at the 2009 World Championships in Berlin."
  },

  // ==========================================
  // TECHNOLOGY & COMPUTING
  // ==========================================
  {
    text: "Who is widely recognized as the world's first computer programmer?",
    options: ["Alan Turing", "Charles Babbage", "Ada Lovelace", "Grace Hopper"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "medium",
    explanation: "Ada Lovelace wrote the first algorithm intended to be executed by Charles Babbage's mechanical Analytical Engine in 1843."
  },
  {
    text: "What does the abbreviation 'HTTP' stand for in web addresses?",
    options: ["HyperText Transfer Protocol", "High Transfer Text Program", "Hyperlink Text Transmission Page", "Host Transport Text Protocol"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "easy",
    explanation: "HTTP (HyperText Transfer Protocol) is the foundational application protocol used for transmitting web documents."
  },
  {
    text: "Which tech company was co-founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976?",
    options: ["Microsoft", "IBM", "Apple", "Hewlett-Packard"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "easy",
    explanation: "Apple Computer was founded on April 1, 1976, in Los Altos, California."
  },
  {
    text: "In computer science, how many bits are in one standard byte?",
    options: ["4", "8", "16", "32"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "A byte consists of 8 binary digits (bits), capable of representing 256 unique values."
  },
  {
    text: "Which programming language was created by Brendan Eich in just 10 days in May 1995?",
    options: ["Python", "Java", "JavaScript", "Ruby"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "medium",
    explanation: "Brendan Eich developed JavaScript (originally codenamed Mocha) at Netscape in May 1995."
  },
  {
    text: "What does the acronym 'GPU' stand for in computer hardware?",
    options: ["General Processing Unit", "Graphics Processing Unit", "Gigabyte Processing Utility", "Grid Parallel Unit"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "A Graphics Processing Unit (GPU) is specialized electronic circuitry designed to rapidly manipulate memory for graphics and parallel workloads."
  },
  {
    text: "Which open-source operating system kernel was created by Linus Torvalds in 1991?",
    options: ["Unix", "Linux", "MINIX", "BSD"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Linus Torvalds published the first version of the Linux kernel as a hobby project while studying at the University of Helsinki."
  },
  {
    text: "What was the name of the first electronic general-purpose digital computer, completed in 1945?",
    options: ["UNIVAC", "ENIAC", "Colossus", "Altair"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "hard",
    explanation: "ENIAC (Electronic Numerical Integrator and Computer) occupied 1,800 square feet and weighed nearly 30 tons."
  },
  {
    text: "Which popular version control system was created by Linus Torvalds in 2005 to manage Linux kernel development?",
    options: ["Subversion", "Mercurial", "Git", "CVS"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "easy",
    explanation: "Linus Torvalds designed Git in 2005 as a fast, distributed version control tool."
  },
  {
    text: "What does 'RAM' stand for in computer specifications?",
    options: ["Rapid Access Module", "Random Access Memory", "Read And Modify", "Real Allocation Memory"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Random Access Memory provides fast read and write access for active operating system tasks and running programs."
  },
  {
    text: "In networking, what does 'DNS' stand for?",
    options: ["Domain Name System", "Digital Network Server", "Direct Network Switch", "Data Naming Service"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "medium",
    explanation: "The Domain Name System translates human-friendly domain names (e.g., spintra.io) into numerical IP addresses."
  },
  {
    text: "Which animal is the official mascot of the Linux operating system?",
    options: ["Fox", "Penguin (Tux)", "Gopher", "Python"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Tux the penguin was chosen as the friendly mascot of Linux in 1996."
  },
  {
    text: "What programming language uses the mascot named 'Ferris the Crab'?",
    options: ["Go", "Swift", "Rust", "Kotlin"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "medium",
    explanation: "Rust developers affectionately call themselves 'Rustaceans' and adopted Ferris the Crab as their unofficial mascot."
  },
  {
    text: "Which computer pioneer is famous for breaking the German Enigma code at Bletchley Park?",
    options: ["John von Neumann", "Alan Turing", "Claude Shannon", "Vint Cerf"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Alan Turing designed the Bombe machine to decipher Enigma-encrypted military communications during World War II."
  },
  {
    text: "What does 'AI' stand for in modern technology?",
    options: ["Automated Intelligence", "Artificial Intelligence", "Advanced Interface", "Algorithmic Integration"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Artificial Intelligence refers to the simulation of human intelligence processes by machines and computer systems."
  },

  // ==========================================
  // ARTS & LITERATURE
  // ==========================================
  {
    text: "Who wrote the classic dystopian novel '1984' published in 1949?",
    options: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "Arthur C. Clarke"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "George Orwell (pen name of Eric Arthur Blair) wrote '1984' warning against totalitarianism and surveillance."
  },
  {
    text: "Which Dutch post-impressionist painter created 'The Starry Night'?",
    options: ["Johannes Vermeer", "Rembrandt", "Vincent van Gogh", "Piet Mondrian"],
    correctIndex: 2,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Van Gogh painted 'The Starry Night' in June 1889 depicting the view from his asylum room in Saint-Rémy-de-Provence."
  },
  {
    text: "Who wrote the epic ancient Greek poems 'The Iliad' and 'The Odyssey'?",
    options: ["Homer", "Sophocles", "Plato", "Virgil"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Homer is traditionally revered as the author of both foundational Western epic poems."
  },
  {
    text: "Which Renaissance sculptor created the famous marble statue of 'David'?",
    options: ["Donatello", "Leonardo da Vinci", "Michelangelo", "Raphael"],
    correctIndex: 2,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Michelangelo Buonarroti sculpted the 17-foot marble masterpiece between 1501 and 1504 in Florence."
  },
  {
    text: "Who wrote the famous gothic novel 'Frankenstein; or, The Modern Prometheus' in 1818?",
    options: ["Mary Shelley", "Bram Stoker", "Emily Brontë", "Jane Austen"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Mary Shelley was only 18 years old when she began writing the story during a rainy summer in Switzerland."
  },
  {
    text: "Which French artist painted 'Water Lilies' ('Nymphéas') in his gardens at Giverny?",
    options: ["Edgar Degas", "Pierre-Auguste Renoir", "Claude Monet", "Paul Cézanne"],
    correctIndex: 2,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Monet spent the last thirty years of his life painting the water-lily pond in his Giverny garden."
  },
  {
    text: "Which Russian author wrote the monumental epic novel 'War and Peace'?",
    options: ["Fyodor Dostoevsky", "Leo Tolstoy", "Anton Chekhov", "Alexander Pushkin"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "medium",
    explanation: "Leo Tolstoy published 'War and Peace' in 1869 chronicling the French invasion of Russia in 1812."
  },
  {
    text: "Who wrote 'The Great Gatsby' depicting the Jazz Age in 1925?",
    options: ["Ernest Hemingway", "F. Scott Fitzgerald", "John Steinbeck", "William Faulkner"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "F. Scott Fitzgerald captured the glamour and tragedy of Jay Gatsby on Long Island during the Roaring Twenties."
  },
  {
    text: "In which museum is the real 'Mona Lisa' painting permanently displayed?",
    options: ["The British Museum", "The Met", "The Louvre", "The Uffizi Gallery"],
    correctIndex: 2,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "The portrait by Leonardo da Vinci hangs in the Salle des États at the Louvre Museum in Paris."
  },
  {
    text: "Who wrote the play 'Hamlet' featuring the famous soliloquy 'To be, or not to be'?",
    options: ["Christopher Marlowe", "William Shakespeare", "Ben Jonson", "John Milton"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Shakespeare's tragedy of the Prince of Denmark was written around 1600."
  },
  {
    text: "Which Spanish surrealist artist painted 'The Persistence of Memory' with melting clocks?",
    options: ["Pablo Picasso", "Joan Miró", "Salvador Dalí", "Francisco Goya"],
    correctIndex: 2,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Salvador Dalí painted the iconic surrealist melting pocket watches in 1931."
  },
  {
    text: "What famous work by Dante Alighieri describes a journey through Hell, Purgatory, and Paradise?",
    options: ["The Decameron", "The Divine Comedy", "Paradise Lost", "The Canterbury Tales"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "medium",
    explanation: "Dante's 14th-century Italian narrative poem 'The Divine Comedy' consists of Inferno, Purgatorio, and Paradiso."
  },
  {
    text: "Who wrote 'Pride and Prejudice' published in 1813?",
    options: ["Charlotte Brontë", "Jane Austen", "Virginia Woolf", "George Eliot"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Jane Austen published the beloved story of Elizabeth Bennet and Mr. Darcy in 1813."
  },
  {
    text: "Which Norwegian artist painted the famous expressionist artwork 'The Scream'?",
    options: ["Edvard Munch", "Gustav Klimt", "Egon Schiele", "Wassily Kandinsky"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "medium",
    explanation: "Edvard Munch created four versions of 'The Scream' between 1893 and 1910."
  },
  {
    text: "What is the Japanese poetic form consisting of three phrases with a 5, 7, 5 syllable structure?",
    options: ["Sonnet", "Haiku", "Limerick", "Tanka"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Traditional haiku poetry uses a 5-7-5 syllable pattern to evoke sensory impressions of nature."
  }
];
