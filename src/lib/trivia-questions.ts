export type TriviaCategory =
  | "General Knowledge"
  | "Science & Nature"
  | "Geography"
  | "History"
  | "Pop Culture"
  | "Sports"
  | "Technology"
  | "Arts & Literature"
  | "Gaming & Internet Culture"
  | "Food & Culinary Arts";

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
  "Gaming & Internet Culture",
  "Food & Culinary Arts",
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
  },
  // ==========================================
  // EXPANDED QUESTION BANK (320+ TOTAL)
  // ==========================================
  {
    text: "Which video game holds the record as the best-selling video game of all time?",
    options: ["Grand Theft Auto V","Minecraft","Tetris","Wii Sports"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Minecraft has sold over 300 million copies across multiple platforms since its release in 2011."
  },
  {
    text: "What is the name of the protagonist in Nintendo's 'The Legend of Zelda' series?",
    options: ["Zelda","Ganon","Link","Sheik"],
    correctIndex: 2,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "The green-clad hero is Link; Princess Zelda is the royal princess he often protects or rescues."
  },
  {
    text: "In Pokémon, which type is super effective against Water-type Pokémon?",
    options: ["Fire","Electric","Rock","Steel"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Electric and Grass moves deal super-effective double damage against Water-type Pokémon."
  },
  {
    text: "What is the highest competitive rank in Counter-Strike: Global Offensive / CS2 matchmaking?",
    options: ["Master Guardian Elite","Distinguished Master","Global Elite","Legendary Eagle"],
    correctIndex: 2,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "The Global Elite is the pinnacle competitive rank achievable in Valve's traditional CS:GO ranking ladder."
  },
  {
    text: "Which studio created the Soulsborne genre, including 'Dark Souls' and 'Elden Ring'?",
    options: ["FromSoftware","Bethesda","Square Enix","Capcom"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "FromSoftware, directed by Hidetaka Miyazaki, pioneered the punishing dark-fantasy action RPG genre."
  },
  {
    text: "What does the gaming acronym 'NPC' stand for?",
    options: ["Non-Playable Character","Next Player Checkpoint","New Player Counter","Non-Protocol Client"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "NPC stands for Non-Playable Character, any entity controlled by computer programming rather than a human."
  },
  {
    text: "Which iconic cheat code is 'Up, Up, Down, Down, Left, Right, Left, Right, B, A'?",
    options: ["Capcom Code","Konami Code","Sega Sequence","Nintendo Key"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "The Konami Code was created by Kazuhisa Hashimoto in 1986 for the game Gradius on the NES."
  },
  {
    text: "In competitive gaming, what does the term 'APM' measure?",
    options: ["Audio Per Minute","Actions Per Minute","Armor Protection Maximum","Accuracy Precision Metric"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "Actions Per Minute measures how many keystrokes and mouse clicks a player executes every 60 seconds."
  },
  {
    text: "Which game popularized the Battle Royale genre before Fortnite launched its BR mode?",
    options: ["Apex Legends","PUBG (PlayerUnknown's Battlegrounds)","Warzone","H1Z1"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "PUBG popularized the 100-player parachute-drop survival formula in early 2017, breaking Steam records."
  },
  {
    text: "What is the maximum number of players in a standard League of Legends Summoner's Rift match?",
    options: ["8","10","12","6"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Summoner's Rift is a 5v5 competitive battlefield, featuring 10 total players."
  },
  {
    text: "Which classic 1993 first-person shooter revolutionized 3D gaming and LAN multiplayer?",
    options: ["DOOM","Half-Life","Duke Nukem 3D","Quake"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "id Software's DOOM, designed by John Carmack and John Romero, redefined the FPS genre and PC gaming."
  },
  {
    text: "In chess and esports slang, what does the term 'tilt' mean?",
    options: ["Changing screen angle","Emotional frustration degrading performance","Swapping team captains","Upgrading graphics settings"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Borrowed from pinball, 'tilt' describes emotional frustration leading to poor tactical decision-making."
  },
  {
    text: "Which voice actor famously voiced Master Chief in the 'Halo' series?",
    options: ["Steve Downes","Nolan North","Troy Baker","David Hayter"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "hard",
    explanation: "Steve Downes provided the stoic, deep voice of SPARTAN-117 (Master Chief) across the Halo saga."
  },
  {
    text: "In 'World of Warcraft', what famous viral video featured a paladin charging into a dragon rookery shouting his own name?",
    options: ["Leeroy Jenkins","Red Shirt Guy","Arthes Menethil","Thrall of Doom"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Ben Schulz's 2005 'Leeroy Jenkins' video became one of the most recognizable internet gaming memes in history."
  },
  {
    text: "What is the primary currency used to purchase items in Roblox?",
    options: ["V-Bucks","Minecoins","Robux","Gems"],
    correctIndex: 2,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Robux is the platform-wide virtual currency in Roblox used for avatar cosmetics and game passes."
  },
  {
    text: "Which video game franchise features the fictional city of Rapture, an underwater Objectivist dystopia?",
    options: ["BioShock","Fallout","Dishonored","Half-Life"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "BioShock (2007) was set in Rapture, founded by the fictional industrialist Andrew Ryan."
  },
  {
    text: "What was the first commercial home video game console ever released (1972)?",
    options: ["Atari 2600","Magnavox Odyssey","Coleco Telstar","Fairchild Channel F"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "hard",
    explanation: "Designed by Ralph Baer and released in September 1972, the Magnavox Odyssey was the world's first home console."
  },
  {
    text: "In speedrunning, what does 'TAS' stand for?",
    options: ["Targeted Attack Speed","Tool-Assisted Speedrun","Total Action Score","Time Allotted System"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "Tool-Assisted Speedrun uses emulators with frame-by-frame inputs and savestates to demonstrate theoretical perfection."
  },
  {
    text: "Which fighting game franchise originated the secret character 'Akuma'?",
    options: ["Tekken","Mortal Kombat","Street Fighter","The King of Fighters"],
    correctIndex: 2,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "Akuma (Gouki) first appeared as a hidden boss in Super Street Fighter II Turbo in 1994."
  },
  {
    text: "What is the highest-grossing media franchise in history, surpassing even Star Wars and Marvel?",
    options: ["Pokémon","Harry Potter","Call of Duty","Super Mario"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "Pokémon has generated over $100 billion in lifetime revenue across video games, cards, and merchandise."
  },
  {
    text: "In Minecraft, which mineral is required to craft Netherite gear?",
    options: ["Ancient Debris","Obsidian Shard","Ender Pearl","Dragon Scale"],
    correctIndex: 0,
    category: "Gaming & Internet Culture",
    difficulty: "medium",
    explanation: "Ancient Debris found deep in the Nether is smelted into Netherite Scrap and combined with Gold to craft ingots."
  },
  {
    text: "What does 'AFK' commonly mean in chat messaging and online lobbies?",
    options: ["Always Fast Kills","Away From Keyboard","All For Kindness","Action Frame Kill"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "AFK stands for 'Away From Keyboard', indicating a player has temporarily stepped away from their computer."
  },
  {
    text: "In Twitch streaming chat culture, which emoticon is universally associated with sarcasm and irony?",
    options: ["PogChamp","Kappa","MonkaS","PepeHands"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "The black-and-white face of former Justin.tv engineer Josh DeSeno ('Kappa') conveys sarcasm."
  },
  {
    text: "Which 2015 indie game created by Toby Fox features a pacifist route where you spare every monster?",
    options: ["Celeste","Hollow Knight","Undertale","Dead Cells"],
    correctIndex: 2,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Undertale allows players to complete the entire story without defeating a single opponent."
  },
  {
    text: "What is the name of the companion AI construct that assists Master Chief in Halo?",
    options: ["Siri","Cortana","GLaDOS","SHODAN"],
    correctIndex: 1,
    category: "Gaming & Internet Culture",
    difficulty: "easy",
    explanation: "Cortana is the UNSC smart artificial intelligence clone of Dr. Catherine Halsey."
  },
  {
    text: "Which spice is known as the most expensive spice in the world by weight?",
    options: ["Vanilla","Cardamom","Saffron","Cinnamon"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Saffron threads come from the delicate stigmas of the Crocus sativus flower, requiring over 75,000 flowers per pound."
  },
  {
    text: "What process gives browned foods, such as seared steak and toasted bread, their distinctive savory flavor?",
    options: ["Fermentation","Maillard reaction","Saponification","Oxidation"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "The Maillard reaction is a chemical reaction between amino acids and reducing sugars that occurs when food browns."
  },
  {
    text: "What is the primary ingredient in traditional hummus?",
    options: ["Lentils","Chickpeas","Soybeans","Black beans"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Hummus is made primarily from cooked, mashed chickpeas blended with tahini, lemon juice, garlic, and olive oil."
  },
  {
    text: "Which cooking technique involves submerging food in a vacuum-sealed bag in a precise temperature water bath?",
    options: ["Sous vide","Blanching","Braising","Poaching"],
    correctIndex: 0,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Sous vide (French for 'under vacuum') cooks food uniformly at exact temperatures for hours."
  },
  {
    text: "Which French culinary term refers to finely chopping ingredients into uniform 1-2mm cubes?",
    options: ["Julienne","Brunoise","Chiffonade","Batonnet"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "hard",
    explanation: "Brunoise is a fine dice where items are first julienned and then cut into uniform tiny cubes."
  },
  {
    text: "What type of pastry dough is used to make croissants and pain au chocolat?",
    options: ["Shortcrust pastry","Laminated dough","Choux pastry","Filo pastry"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "Laminated dough consists of many alternating thin layers of butter and dough folded repeatedly."
  },
  {
    text: "Which country is the birthplace of the Caesar salad?",
    options: ["Italy","United States","Mexico","Greece"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "Caesar salad was invented in 1924 by Italian-American restaurateur Caesar Cardini at his restaurant in Tijuana, Mexico."
  },
  {
    text: "What cheese is traditionally used to top an authentic Neapolitan pizza margherita?",
    options: ["Parmigiano Reggiano","Fresh Mozzarella","Provolone","Ricotta"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Fresh Mozzarella di Bufala Campana or Fior di Latte is the traditional cheese for Neapolitan pizza."
  },
  {
    text: "What is the fifth primary taste quality, alongside sweet, salty, sour, and bitter?",
    options: ["Pungency","Umami","Spiciness","Astringency"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Umami, meaning 'pleasant savory taste' in Japanese, is stimulated by glutamates found in meat, cheese, and mushrooms."
  },
  {
    text: "What grain is traditional sushi rice made of?",
    options: ["Long-grain Basmati","Short-grain Japonica","Jasmine rice","Wild rice"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "Short-grain Japonica rice has a high amylopectin starch content that creates the stickiness required for sushi."
  },
  {
    text: "Which scale measures the pungency or spiciness of chili peppers?",
    options: ["Brix scale","Scoville scale","Mohs scale","Baumé scale"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "The Scoville scale, devised by Wilbur Scoville in 1912, measures capsaicin concentration in heat units (SHU)."
  },
  {
    text: "In classical French cuisine, which of the following is NOT one of the five 'mother sauces'?",
    options: ["Béchamel","Hollandaise","Chimichurri","Velouté"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "The 5 French mother sauces defined by Auguste Escoffier are Béchamel, Velouté, Espagnole, Sauce Tomat, and Hollandaise."
  },
  {
    text: "What variety of tea is oxidized the most during processing?",
    options: ["Green tea","White tea","Black tea","Oolong tea"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Black tea leaves undergo complete oxidation, turning dark and yielding a bold, robust brew."
  },
  {
    text: "What is the main vegetable component of traditional German sauerkraut?",
    options: ["Turnip","Cabbage","Beetroot","Kale"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Sauerkraut is finely shredded cabbage that has been fermented by various lactic acid bacteria."
  },
  {
    text: "From which country does the blue cheese Roquefort originate?",
    options: ["Switzerland","Italy","France","United Kingdom"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Roquefort is a sheep milk cheese aged in the natural Combalou caves of Roquefort-sur-Soulzon in southern France."
  },
  {
    text: "What chemical compound in onions causes human eyes to tear up when slicing?",
    options: ["Syn-propanethial-S-oxide","Capsaicin","Acetic acid","Citric acid"],
    correctIndex: 0,
    category: "Food & Culinary Arts",
    difficulty: "hard",
    explanation: "Cutting onions ruptures cell walls, releasing lachrymatory factor synthase which forms volatile syn-propanethial-S-oxide."
  },
  {
    text: "What is the traditional Japanese soup stock made from kombu (kelp) and katsuobushi (bonito flakes)?",
    options: ["Miso","Dashi","Tonkotsu","Shoyu"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "Dashi forms the fundamental savory base of Japanese noodle broths and miso soups."
  },
  {
    text: "Which fortified Spanish wine from Andalusia is matured using the dynamic 'solera' barrel system?",
    options: ["Port","Sherry","Madeira","Marsala"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "Sherry (Jerez) is aged through tiered solera barrels, blending older and younger vintages continuously."
  },
  {
    text: "What is the primary leavening agent used in traditional sourdough bread?",
    options: ["Baking soda","Wild yeast and lactobacilli","Cream of tartar","Commercial active dry yeast"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Sourdough relies on a fermented starter culture teeming with wild yeasts and lactic acid bacteria."
  },
  {
    text: "What cut of beef comes from the underside belly area and is popular for fajitas and stir-fries?",
    options: ["Flank / Skirt steak","T-bone","Ribeye","Filet mignon"],
    correctIndex: 0,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Skirt and flank steaks come from abdominal muscles, offering intense beefy flavor when sliced across the grain."
  },
  {
    text: "Which fruit is famous in Southeast Asia for its pungent aroma that often gets it banned on public transport?",
    options: ["Rambutan","Durian","Dragonfruit","Jackfruit"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Durian has a notoriously pungent sulfurous aroma that contrasts with its creamy custard-like interior."
  },
  {
    text: "What is the key alcoholic spirit used in a traditional Mojito cocktail?",
    options: ["Vodka","Gin","White Rum","Tequila"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "A Cuban Mojito blends white rum, fresh mint, lime juice, sugar, and club soda."
  },
  {
    text: "Which legume is the primary ingredient in Indian dal dishes like Tadka Dal and Dal Makhani?",
    options: ["Lentils / Split pulses","Quinoa","Barley","Millet"],
    correctIndex: 0,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Dal refers to dried split pulses such as lentils, pigeon peas, and chickpeas cooked into rich spiced stews."
  },
  {
    text: "What is the sweet almond paste commonly shaped and colored into decorative confections and figurines?",
    options: ["Nougat","Marzipan","Praline","Ganache"],
    correctIndex: 1,
    category: "Food & Culinary Arts",
    difficulty: "easy",
    explanation: "Marzipan is a pliable confection made of ground almonds, sugar, and egg whites or glucose syrup."
  },
  {
    text: "Which cooking oil has the highest smoke point among common kitchen oils (approx. 510-520°F)?",
    options: ["Extra virgin olive oil","Butter","Avocado oil","Sesame oil"],
    correctIndex: 2,
    category: "Food & Culinary Arts",
    difficulty: "medium",
    explanation: "Refined avocado oil has an exceptionally high smoke point of ~520°F (270°C), ideal for high-heat searing."
  },
  {
    text: "Which currency is officially used in the United Kingdom?",
    options: ["Euro","British Pound Sterling","Swiss Franc","Krone"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "The British Pound Sterling (GBP, symbol £) is the official currency of the United Kingdom."
  },
  {
    text: "How many colors are in a traditional rainbow?",
    options: ["5","6","7","8"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Sir Isaac Newton defined the 7 rainbow spectrum colors: Red, Orange, Yellow, Green, Blue, Indigo, and Violet (ROYGBIV)."
  },
  {
    text: "What is the hardest natural mineral found on Earth?",
    options: ["Quartz","Topaz","Corundum","Diamond"],
    correctIndex: 3,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Diamond rates a maximum 10 on the Mohs mineral hardness scale due to its rigid carbon crystal lattice."
  },
  {
    text: "How many dots appear on a standard six-sided die?",
    options: ["20","21","22","24"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "1 + 2 + 3 + 4 + 5 + 6 = 21 total pips across all six faces."
  },
  {
    text: "In standard nautical navigation, what side of a ship is 'port'?",
    options: ["Right side","Left side","Front side","Stern side"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Facing forward toward the bow, Port is the left-hand side, and Starboard is the right-hand side."
  },
  {
    text: "Which animal is featured on the official state flag of California?",
    options: ["Golden Eagle","Grizzly Bear","Mountain Lion","Bison"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "The California Bear Flag features a California grizzly bear walking across a patch of green grass."
  },
  {
    text: "How many degrees are there in a complete circle?",
    options: ["180°","270°","360°","400°"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "A full geometric circle contains 360 degrees, a division inherited from ancient Babylonian astronomy."
  },
  {
    text: "What is the official language of Brazil?",
    options: ["Spanish","Portuguese","French","Italian"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Unlike the majority of South America which speaks Spanish, Brazil's official language is Portuguese."
  },
  {
    text: "Which international phonetic alphabet code word represents the letter 'M'?",
    options: ["Mango","Mike","Madrid","Mercury"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "In the NATO phonetic alphabet, M is represented by 'Mike'."
  },
  {
    text: "What is the national flower of Japan, celebrated every spring?",
    options: ["Lotus","Cherry Blossom (Sakura)","Orchid","Chrysanthemum"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Cherry blossoms (Sakura) represent renewal and the ephemeral nature of life throughout Japanese culture."
  },
  {
    text: "What is the Roman numeral for 500?",
    options: ["C","D","M","L"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "medium",
    explanation: "In Roman numerals: C = 100, D = 500, and M = 1000."
  },
  {
    text: "Which animal is the largest mammal currently living on Earth?",
    options: ["African Bush Elephant","Blue Whale","Sperm Whale","Colossal Squid"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "The blue whale can reach lengths of up to 100 feet (30 meters) and weigh over 190 metric tons."
  },
  {
    text: "How many days are in a standard leap year?",
    options: ["364","365","366","367"],
    correctIndex: 2,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "A leap year adds February 29th to adjust for Earth's ~365.242-day solar orbit, totalling 366 days."
  },
  {
    text: "What does the Latin phrase 'Carpe Diem' translate to in English?",
    options: ["Seize the day","Remember death","Truth conquers all","Out of many, one"],
    correctIndex: 0,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "Originating in Horace's Odes, 'Carpe Diem' translates to 'pluck or seize the day'."
  },
  {
    text: "Which bird is universally recognized as an international symbol of peace?",
    options: ["Eagle","White Dove","Swan","Owl"],
    correctIndex: 1,
    category: "General Knowledge",
    difficulty: "easy",
    explanation: "The white dove, especially carrying an olive branch, has been a symbol of peace since ancient Mediterranean antiquity."
  },
  {
    text: "What type of star is our Sun classified as?",
    options: ["Red Giant","Yellow Dwarf (G-type main-sequence)","White Dwarf","Blue Supergiant"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "The Sun is a G-type main-sequence star (G2V), commonly referred to as a yellow dwarf."
  },
  {
    text: "What is the primary function of white blood cells (leukocytes) in humans?",
    options: ["Carrying oxygen","Clotting blood","Fighting infection and disease","Regulating body heat"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Leukocytes protect the body against pathogens, infectious diseases, and foreign invaders as part of the immune system."
  },
  {
    text: "What is the name of the process by which plants release water vapor through their leaves?",
    options: ["Transpiration","Condensation","Precipitation","Infiltration"],
    correctIndex: 0,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Transpiration is the evaporation of water from plant aerial parts, especially through microscopic leaf stomata."
  },
  {
    text: "Which geological era is nicknamed the 'Age of the Dinosaurs'?",
    options: ["Paleozoic","Mesozoic","Cenozoic","Precambrian"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "The Mesozoic Era (consisting of the Triassic, Jurassic, and Cretaceous periods) was dominated by dinosaurs."
  },
  {
    text: "What is the pH value of pure distilled water at 25°C?",
    options: ["0","5","7","14"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Pure water has a neutral pH of 7.0, balancing equal concentrations of hydrogen and hydroxide ions."
  },
  {
    text: "Which element has the highest electrical conductivity of all metals at room temperature?",
    options: ["Copper","Silver","Gold","Aluminum"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Silver is the most electrically conductive metal, though copper is more commonly used due to cost considerations."
  },
  {
    text: "What layer of Earth's atmosphere contains the majority of clouds and weather events?",
    options: ["Stratosphere","Troposphere","Mesosphere","Thermosphere"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "The troposphere extends 7-20 km above Earth and holds about 75% of atmospheric mass and 99% of its water vapor."
  },
  {
    text: "Which scientist formulated the Three Laws of Motion in his 1687 work 'Principia'?",
    options: ["Galileo Galilei","Isaac Newton","Albert Einstein","Johannes Kepler"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Sir Isaac Newton laid the foundation for classical mechanics with his three laws of motion and universal gravitation."
  },
  {
    text: "What is the fastest land animal in the world, capable of sprinting over 60 mph (97 km/h)?",
    options: ["Pronghorn","Cheetah","Lion","Springbok"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The cheetah can accelerate from 0 to 60 mph in under three seconds, making it the fastest terrestrial creature."
  },
  {
    text: "What is the name of the boundary around a black hole beyond which nothing can escape?",
    options: ["Photon Sphere","Event Horizon","Ergosphere","Singularity"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "The event horizon marks the mathematical threshold where gravitational escape velocity exceeds the speed of light."
  },
  {
    text: "Which subatomic particle carries a negative electric charge?",
    options: ["Proton","Neutron","Electron","Positron"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Electrons orbit the atomic nucleus and carry an elementary negative electrical charge (-1e)."
  },
  {
    text: "What is the most abundant protein found in mammals, providing structural support to connective tissues?",
    options: ["Keratin","Hemoglobin","Collagen","Myosin"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Collagen makes up roughly 30% of total mammal protein, forming tendons, ligaments, skin, and cartilage."
  },
  {
    text: "What is the process called when a solid turns directly into a gas without passing through a liquid state?",
    options: ["Evaporation","Sublimation","Deposition","Condensation"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "medium",
    explanation: "Sublimation occurs when solid dry ice (frozen carbon dioxide) or frost vaporizes directly into gas."
  },
  {
    text: "What is the only mammal capable of true, sustained flapping flight?",
    options: ["Flying squirrel","Bat","Sugar glider","Colugo"],
    correctIndex: 1,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Bats (order Chiroptera) are the only mammals capable of sustained flapping flight rather than passive gliding."
  },
  {
    text: "What branch of biology is dedicated specifically to the scientific study of insects?",
    options: ["Herpetology","Ornithology","Entomology","Ichthyology"],
    correctIndex: 2,
    category: "Science & Nature",
    difficulty: "easy",
    explanation: "Entomology is the scientific study of insects; herpetology studies reptiles/amphibians, and ornithology studies birds."
  },
  {
    text: "Which country possesses the longest continuous coastline in the world (over 202,000 km)?",
    options: ["Russia","Canada","Norway","Indonesia"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "Canada's vast Arctic and maritime archipelagos give it over 202,080 km of coastline, the most on Earth."
  },
  {
    text: "Which African country was formerly known as Abyssinia?",
    options: ["Sudan","Ethiopia","Eritrea","Somalia"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "The Ethiopian Empire was historically known as Abyssinia until the 20th century."
  },
  {
    text: "Which European country has the most natural islands (over 260,000 islands)?",
    options: ["Greece","Norway","Sweden","Finland"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "hard",
    explanation: "Sweden boasts approximately 267,570 islands, the highest count of any country in the world."
  },
  {
    text: "What is the largest hot desert on Earth?",
    options: ["Gobi Desert","Kalahari Desert","Sahara Desert","Arabian Desert"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Sahara Desert covers approximately 9.2 million square kilometers across Northern Africa."
  },
  {
    text: "Which strait separates the continents of Europe and Asia in Istanbul?",
    options: ["Dardanelles","Bosphorus Strait","Strait of Gibraltar","Strait of Hormuz"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Bosphorus Strait bisects Istanbul, linking the Black Sea with the Sea of Marmara and dividing Europe and Asia."
  },
  {
    text: "What is the capital city of Canada?",
    options: ["Toronto","Montreal","Vancouver","Ottawa"],
    correctIndex: 3,
    category: "Geography",
    difficulty: "easy",
    explanation: "Queen Victoria chose Ottawa as Canada's capital in 1857 because of its defensible inland location."
  },
  {
    text: "Which country features the world's highest uninterrupted waterfall, Angel Falls?",
    options: ["Brazil","Venezuela","Colombia","Guyana"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "Angel Falls (Kerepakupai Merú) drops 979 meters (3,212 feet) from Auyán-tepui in Canaima National Park, Venezuela."
  },
  {
    text: "What is the deepest lake in the world, holding roughly 20% of the world's unfrozen surface fresh water?",
    options: ["Lake Superior","Lake Baikal","Lake Victoria","Lake Tanganyika"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "Lake Baikal in Siberia plunges to a maximum depth of 1,642 meters (5,387 feet)."
  },
  {
    text: "Which river flows through Paris, France?",
    options: ["Danube","Rhine","Seine","Thames"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "The River Seine meanders through the heart of Paris, dividing the city into the Left Bank and Right Bank."
  },
  {
    text: "What is the smallest independent sovereign state in the world by area and population?",
    options: ["Monaco","Vatican City","San Marino","Liechtenstein"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "Vatican City encompasses just 0.49 square kilometers (121 acres) completely surrounded by Rome, Italy."
  },
  {
    text: "Which mountain range separates the Iberian Peninsula from the rest of continental Europe?",
    options: ["Alps","Pyrenees","Carpathians","Apennines"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "medium",
    explanation: "The Pyrenees mountains stretch along the natural border between Spain and France."
  },
  {
    text: "Which country controls the Galápagos Islands?",
    options: ["Peru","Ecuador","Chile","Costa Rica"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Galápagos archipelago is an official province of Ecuador located 1,000 km west in the Pacific Ocean."
  },
  {
    text: "What is the capital city of New Zealand?",
    options: ["Auckland","Christchurch","Wellington","Queenstown"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "easy",
    explanation: "Wellington is the constitutional capital of New Zealand, located at the southern tip of the North Island."
  },
  {
    text: "Which African lake is the largest tropical freshwater lake in the world by surface area?",
    options: ["Lake Malawi","Lake Tanganyika","Lake Victoria","Lake Chad"],
    correctIndex: 2,
    category: "Geography",
    difficulty: "medium",
    explanation: "Lake Victoria spans 59,947 square kilometers across Uganda, Kenya, and Tanzania."
  },
  {
    text: "What sea is bordered by Jordan, Israel, and the West Bank and is known for its extreme salinity?",
    options: ["Red Sea","Dead Sea","Caspian Sea","Aral Sea"],
    correctIndex: 1,
    category: "Geography",
    difficulty: "easy",
    explanation: "The Dead Sea's 34% salinity makes the water nearly ten times saltier than the ocean, allowing swimmers to float effortlessly."
  },
  {
    text: "In which year did the Apollo 11 mission successfully land the first humans on the Moon?",
    options: ["1965","1969","1971","1973"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Neil Armstrong and Buzz Aldrin stepped onto the lunar surface on July 20, 1969."
  },
  {
    text: "Who was the first emperor of a unified China, known for commissioning the Terracotta Army?",
    options: ["Qin Shi Huang","Han Wudi","Kublai Khan","Sun Yat-sen"],
    correctIndex: 0,
    category: "History",
    difficulty: "easy",
    explanation: "Qin Shi Huang conquered the Warring States and founded the Qin dynasty in 221 BC."
  },
  {
    text: "Which ancient civilization constructed the cliff citadel of Machu Picchu high in the Andes?",
    options: ["Maya","Aztec","Inca","Olmec"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy",
    explanation: "Machu Picchu was built in the 15th century as an estate for the Inca emperor Pachacuti."
  },
  {
    text: "In what year did the Berlin Wall fall, signaling the impending end of the Cold War in Europe?",
    options: ["1987","1989","1991","1993"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "The Berlin Wall was breached by joyous crowds on the night of November 9, 1989."
  },
  {
    text: "Who was the female pharaoh of Egypt who formed historic alliances with Julius Caesar and Mark Antony?",
    options: ["Nefertiti","Hatshepsut","Cleopatra VII","Sobekneferu"],
    correctIndex: 2,
    category: "History",
    difficulty: "easy",
    explanation: "Cleopatra VII Philopator was the last active ruler of the Ptolemaic Kingdom of Egypt."
  },
  {
    text: "What famous naval battle in 1805 cemented British naval supremacy during the Napoleonic Wars?",
    options: ["Battle of Waterloo","Battle of Trafalgar","Battle of Jutland","Battle of Midway"],
    correctIndex: 1,
    category: "History",
    difficulty: "medium",
    explanation: "Admiral Lord Nelson defeated the combined French and Spanish fleets at Trafalgar off southwest Spain."
  },
  {
    text: "Which treaty, signed in 1919 in the Hall of Mirrors, formally concluded World War I?",
    options: ["Treaty of Versailles","Treaty of Ghent","Treaty of Utrecht","Treaty of Paris"],
    correctIndex: 0,
    category: "History",
    difficulty: "easy",
    explanation: "The Treaty of Versailles imposed heavy reparations and territorial losses on Germany in June 1919."
  },
  {
    text: "Who was the legendary king of the Mali Empire famed for his pilgrimage to Mecca with tons of gold in 1324?",
    options: ["Sundiata Keita","Mansa Musa","Askia the Great","Sonni Ali"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Mansa Musa's lavish pilgrimage distributed so much gold in Cairo that it caused regional currency inflation for a decade."
  },
  {
    text: "Which ancient military commander marched war elephants over the Alps to invade Rome in 218 BC?",
    options: ["Alexander the Great","Hannibal Barca","Scipio Africanus","Pyrrhus of Epirus"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Carthaginian general Hannibal led his army and 37 war elephants across the Alps during the Second Punic War."
  },
  {
    text: "Which French military leader and heroine was burned at the stake in Rouen in 1431?",
    options: ["Marie Antoinette","Joan of Arc","Catherine de' Medici","Eleanor of Aquitaine"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Joan of Arc led French troops to relieve the Siege of Orléans before being captured and executed at age 19."
  },
  {
    text: "What Russian fortress in Moscow serves as the official residence of the President of the Russian Federation?",
    options: ["The Hermitage","The Kremlin","Peterhof","Winter Palace"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "The Moscow Kremlin is a fortified complex overlooking the Moskva River and Red Square."
  },
  {
    text: "Which document was signed by King John of England at Runnymede in 1215, limiting monarchical power?",
    options: ["Bill of Rights","Magna Carta","Domesday Book","Petition of Right"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Magna Carta ('Great Charter') established for the first time the principle that everybody, even the king, is subject to the law."
  },
  {
    text: "In which city were the famous war crimes trials held following the conclusion of World War II in Europe?",
    options: ["Berlin","Nuremberg","Munich","Frankfurt"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "The Nuremberg Trials prosecuted prominent leaders of Nazi Germany before the International Military Tribunal."
  },
  {
    text: "Who was the first president of democratic South Africa, elected in 1994 following the end of Apartheid?",
    options: ["Desmond Tutu","Nelson Mandela","F.W. de Klerk","Thabo Mbeki"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Nelson Mandela served 27 years in prison before winning South Africa's first multiracial democratic election in 1994."
  },
  {
    text: "What volcanic eruption destroyed the ancient Roman cities of Pompeii and Herculaneum in 79 AD?",
    options: ["Mount Etna","Mount Vesuvius","Mount Stromboli","Santorini"],
    correctIndex: 1,
    category: "History",
    difficulty: "easy",
    explanation: "Mount Vesuvius erupted catastrophically in August/October 79 AD, entombing Roman settlements under ash."
  },
  {
    text: "Which actor portrayed Neo (Thomas Anderson) in the landmark 1999 sci-fi action film 'The Matrix'?",
    options: ["Brad Pitt","Keanu Reeves","Tom Cruise","Will Smith"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Keanu Reeves starred as Neo in the Wachowskis' groundbreaking cyberpunk film 'The Matrix'."
  },
  {
    text: "What fictional language is spoken by the warrior race in Star Trek, featuring words like 'Qapla'?",
    options: ["Vulcan","Klingon","Romulan","Cardassian"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Linguist Marc Okrand developed Klingon into a fully functional constructed language for Paramount Pictures."
  },
  {
    text: "Which pop icon released the record-breaking album 'Thriller' in 1982?",
    options: ["Prince","Michael Jackson","Madonna","Stevie Wonder"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Michael Jackson's 'Thriller' remains the best-selling studio album in global music history."
  },
  {
    text: "What is the name of the coffee shop where the characters frequently gather in the TV sitcom 'Friends'?",
    options: ["Monk's Diner","Central Perk","MacLaren's Pub","The Peach Pit"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Central Perk was the beloved Manhattan gathering coffeehouse in 'Friends', managed by Gunther."
  },
  {
    text: "Who wrote and directed the groundbreaking 2010 sci-fi heist movie 'Inception'?",
    options: ["Denis Villeneuve","Christopher Nolan","James Cameron","Quentin Tarantino"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Christopher Nolan directed Leonardo DiCaprio in the mind-bending dream-heist thriller 'Inception'."
  },
  {
    text: "What is the highest-grossing film of all time at the global box office (unadjusted for inflation)?",
    options: ["Avengers: Endgame","Titanic","Avatar (2009)","Star Wars: The Force Awakens"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "James Cameron's sci-fi epic 'Avatar' has grossed over $2.92 billion worldwide across its releases."
  },
  {
    text: "Which female solo artist set attendance records worldwide with 'The Eras Tour' launched in 2023?",
    options: ["Beyoncé","Taylor Swift","Adele","Billie Eilish"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Taylor Swift's 'The Eras Tour' became the first concert tour in music history to gross over $1 billion."
  },
  {
    text: "In 'Game of Thrones', what is the ancestral Valyrian steel sword of House Stark?",
    options: ["Longclaw","Ice","Needle","Oathkeeper"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "medium",
    explanation: "Ice was the massive ancestral greatsword of Lord Eddard Stark, later melted down into Widow's Wail and Oathkeeper."
  },
  {
    text: "Who directed the landmark anime masterpiece 'Spirited Away' (2001) for Studio Ghibli?",
    options: ["Hayao Miyazaki","Isao Takahata","Makoto Shinkai","Satoshi Kon"],
    correctIndex: 0,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Hayao Miyazaki won the Academy Award for Best Animated Feature for 'Spirited Away'."
  },
  {
    text: "What animated Disney film features the catchy hit song 'Let It Go' sung by Idina Menzel?",
    options: ["Tangled","Moana","Frozen","Brave"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "'Let It Go' was composed by Kristen Anderson-Lopez and Robert Lopez for Disney's 2013 blockbuster 'Frozen'."
  },
  {
    text: "What is the name of the upside-down alternate dimension in the Netflix series 'Stranger Things'?",
    options: ["The Void","The Upside Down","The Nether","The Shadow Realm"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "The Upside Down is a dark, decaying parallel dimension mirroring the human world of Hawkins, Indiana."
  },
  {
    text: "Which musical artist performed the halftime show at Super Bowl LVII (2023) suspended on floating platforms?",
    options: ["Rihanna","Lady Gaga","The Weeknd","Katy Perry"],
    correctIndex: 0,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Rihanna performed an energetic solo medley of her biggest hits while pregnant on suspended floating platforms."
  },
  {
    text: "Who won the Academy Award for Best Actor for his role as the Joker in the 2019 film 'Joker'?",
    options: ["Heath Ledger","Joaquin Phoenix","Christian Bale","Cillian Murphy"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "Joaquin Phoenix won the Oscar for his psychological portrayal of Arthur Fleck in Todd Phillips' 'Joker'."
  },
  {
    text: "What British rock band released the albums 'OK Computer' (1997) and 'Kid A' (2000)?",
    options: ["Oasis","Coldplay","Radiohead","Blur"],
    correctIndex: 2,
    category: "Pop Culture",
    difficulty: "medium",
    explanation: "Thom Yorke fronted the experimental alt-rock band Radiohead on their era-defining critical triumphs."
  },
  {
    text: "Which author wrote the bestselling fantasy series 'A Song of Ice and Fire'?",
    options: ["J.R.R. Tolkien","George R.R. Martin","Brandon Sanderson","Robert Jordan"],
    correctIndex: 1,
    category: "Pop Culture",
    difficulty: "easy",
    explanation: "George R.R. Martin created the sprawling world of Westeros adapted into HBO's 'Game of Thrones'."
  },
  {
    text: "Which country has won the most FIFA Men's World Cup titles (5 titles)?",
    options: ["Germany","Italy","Brazil","Argentina"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "Brazil won the Men's World Cup in 1958, 1962, 1970, 1994, and 2002."
  },
  {
    text: "What distance is run in an official Olympic marathon?",
    options: ["24.2 miles","26.2 miles (42.195 km)","28.5 miles","30.0 miles"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "The official marathon distance of 26 miles 385 yards (42.195 km) was standardized at the 1908 London Olympics."
  },
  {
    text: "In tennis, what score is referred to by the term 'deuce'?",
    options: ["30-30","40-40","15-15","Advantage"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "Deuce occurs when both players or teams have won 3 points each (40-40), requiring a 2-point margin to win."
  },
  {
    text: "Which NBA superstar holds the record for the most total career points scored in regular season history?",
    options: ["Michael Jordan","Kareem Abdul-Jabbar","LeBron James","Kobe Bryant"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "LeBron James surpassed Kareem Abdul-Jabbar's longstanding record of 38,387 points in February 2023."
  },
  {
    text: "How many players are on the field for one team in a standard soccer (association football) match?",
    options: ["9","10","11","12"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "A standard soccer squad fields 11 players simultaneously, including one designated goalkeeper."
  },
  {
    text: "Which golf tournament awards its champion an iconic Green Jacket?",
    options: ["The Open Championship","The Masters Tournament","U.S. Open","PGA Championship"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "The Masters Tournament, held annually at Augusta National Golf Club in Georgia, awards the Green Jacket."
  },
  {
    text: "In American Football (NFL), how many points is a touchdown worth before the extra point try?",
    options: ["3","6","7","8"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "Crossing the goal line for a touchdown awards 6 points; an extra kick adds 1 point (or 2 for a conversion)."
  },
  {
    text: "Which swimmer has won the most Olympic gold medals of all time (23 gold medals)?",
    options: ["Mark Spitz","Michael Phelps","Ian Thorpe","Caeleb Dressel"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "Michael Phelps won 23 gold medals (and 28 total Olympic medals) across the 2004 to 2016 Summer Games."
  },
  {
    text: "What piece of equipment is used instead of a ball in the sport of ice hockey?",
    options: ["Shuttlecock","Puck","Stone","Pellet"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "A hockey puck is made of vulcanized rubber and measures 3 inches in diameter."
  },
  {
    text: "In cricket, how many runs are scored when a batsman hits the ball over the boundary on the full without bouncing?",
    options: ["4","5","6","8"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "Hitting the ball clear over the boundary rope on the fly scores a maximum 6 runs."
  },
  {
    text: "Which country hosted the first modern Olympic Games in 1896?",
    options: ["France","United Kingdom","Greece","United States"],
    correctIndex: 2,
    category: "Sports",
    difficulty: "easy",
    explanation: "Athens, Greece hosted the inaugural 1896 Summer Olympics, reviving the ancient Greek tradition."
  },
  {
    text: "What is the diameter of an official basketball hoop rim in inches?",
    options: ["16 inches","18 inches","20 inches","22 inches"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "medium",
    explanation: "Regulation basketball rims have an inside diameter of exactly 18 inches (45.7 cm) at a height of 10 feet."
  },
  {
    text: "In Formula 1 racing, what color flag indicates the winner has crossed the finish line?",
    options: ["Green flag","Checkered black and white flag","Yellow flag","Red flag"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "The checkered black-and-white flag signals the official end of a motor race."
  },
  {
    text: "Which track and field sprinter holds the world records in both the 100m and 200m sprints?",
    options: ["Tyson Gay","Usain Bolt","Carl Lewis","Yohan Blake"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "easy",
    explanation: "Jamaica's Usain Bolt set world records of 9.58 seconds (100m) and 19.19 seconds (200m) in Berlin in 2009."
  },
  {
    text: "In bowling, what term refers to scoring three consecutive strikes in a row?",
    options: ["Hat trick","Turkey","Eagle","Triple Crown"],
    correctIndex: 1,
    category: "Sports",
    difficulty: "medium",
    explanation: "Three strikes in a row is traditionally called a 'turkey', dating back to tournaments that awarded actual turkeys."
  },
  {
    text: "Who is widely regarded as the world's first computer programmer for writing an algorithm for the Analytical Engine?",
    options: ["Alan Turing","Ada Lovelace","Grace Hopper","Charles Babbage"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Ada Lovelace published the first algorithm intended for processing by Babbage's mechanical computer in 1843."
  },
  {
    text: "What does the network protocol acronym 'HTTP' stand for?",
    options: ["HyperText Transfer Protocol","High Thermal Transmission Port","Host Text Terminal Provider","Hyperlink Traffic Process"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "easy",
    explanation: "HyperText Transfer Protocol is the foundational application protocol used to exchange web resources."
  },
  {
    text: "Which programming language was created by Brendan Eich at Netscape in 1995 in just 10 days?",
    options: ["Python","Java","JavaScript","PHP"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "easy",
    explanation: "Eich developed Mocha (quickly renamed LiveScript, then JavaScript) in May 1995 for Netscape Navigator."
  },
  {
    text: "In computing, how many bytes are in a standard kilobyte (KB) in decimal SI units?",
    options: ["1000 bytes","1024 bytes","1048 bytes","512 bytes"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "medium",
    explanation: "Under the International System of Units (SI), 1 KB = 1000 bytes; 1024 bytes is technically a kibibyte (KiB)."
  },
  {
    text: "Which company originally developed the TypeScript programming language?",
    options: ["Google","Facebook","Microsoft","Oracle"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "easy",
    explanation: "Anders Hejlsberg and Microsoft released TypeScript in 2012 as a typed superset of JavaScript."
  },
  {
    text: "What was the name of Apple's first mobile phone, released in June 2007?",
    options: ["iPhone 3G","iPhone (Original / 2G)","Apple Newton","iPod Touch"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Steve Jobs unveiled the original iPhone in January 2007, and it launched on June 29, 2007."
  },
  {
    text: "In cryptography and databases, what does 'SHA' stand for in SHA-256?",
    options: ["Secure Hash Algorithm","System Hardware Accelerator","Sequential Host Array","Synchronous High Accuracy"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "easy",
    explanation: "Secure Hash Algorithm is a cryptographic hash function family designed by the National Security Agency (NSA)."
  },
  {
    text: "Which British mathematician proved the theoretical limits of computation with the concept of a Universal Machine in 1936?",
    options: ["John von Neumann","Alan Turing","Claude Shannon","Bertrand Russell"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Alan Turing formalized the concepts of algorithm and computation with the Turing Machine."
  },
  {
    text: "What port number does secure web traffic (HTTPS) default to?",
    options: ["21","80","443","8080"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "medium",
    explanation: "Port 80 is used for unencrypted HTTP, while Port 443 is standard for encrypted HTTPS traffic."
  },
  {
    text: "Which technology company designed the ARM processor architecture originally found in Acorn computers?",
    options: ["Intel","Motorola","Arm Holdings","Texas Instruments"],
    correctIndex: 2,
    category: "Technology",
    difficulty: "medium",
    explanation: "Acorn Computers developed the Acorn RISC Machine (later Arm Holdings), which now powers billions of mobile chips."
  },
  {
    text: "What does the computing acronym 'RAM' stand for?",
    options: ["Random Access Memory","Read Access Module","Rapid Action Microchip","Remote Array Matrix"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "easy",
    explanation: "Random Access Memory allows stored data to be accessed directly in any random order in constant time."
  },
  {
    text: "Which relational database query language was originally developed at IBM by Donald Chamberlin and Raymond Boyce in the 1970s?",
    options: ["GraphQL","SQL (Structured Query Language)","MongoDB","Fortran"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Originally named SEQUEL, SQL was created to manipulate and retrieve data from Edgar F. Codd's relational model."
  },
  {
    text: "What is the wireless networking standard marketed commercially as 'Wi-Fi' formally known as?",
    options: ["IEEE 802.3","IEEE 802.11","IEEE 802.15","IEEE 1394"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "medium",
    explanation: "The IEEE 802.11 technical committee defines local area wireless computer networking standards."
  },
  {
    text: "What is the term for a software vulnerability that is exploited by attackers before the vendor is aware or has issued a patch?",
    options: ["Zero-day exploit","Trojan horse","Brute-force","Man-in-the-middle"],
    correctIndex: 0,
    category: "Technology",
    difficulty: "easy",
    explanation: "A zero-day exploit targets a flaw with zero days of notice to the developer to develop an official defense."
  },
  {
    text: "What does the computing hardware acronym 'GPU' stand for?",
    options: ["General Processing Unit","Graphics Processing Unit","Geographic Pixel Utility","Global Protocol Unit"],
    correctIndex: 1,
    category: "Technology",
    difficulty: "easy",
    explanation: "Graphics Processing Unit (GPU) specializes in rendering 3D graphics and massively parallel computing tasks."
  },
  {
    text: "Which French sculptor created 'The Thinker' ('Le Penseur')?",
    options: ["Camille Claudel","Auguste Rodin","Alberto Giacometti","Aristide Maillol"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Auguste Rodin originally conceived 'The Thinker' in 1880 as part of his monumental portal 'The Gates of Hell'."
  },
  {
    text: "Who wrote the 1851 classic American novel 'Moby-Dick; or, The Whale'?",
    options: ["Nathaniel Hawthorne","Herman Melville","Mark Twain","Edgar Allan Poe"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Herman Melville wrote the story of Captain Ahab's obsessive pursuit of the white whale Moby Dick."
  },
  {
    text: "What Mexican painter is famous for her numerous intense self-portraits and depictions of pain and Mexican folk culture?",
    options: ["Remedios Varo","Frida Kahlo","Leonora Carrington","María Izquierdo"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Frida Kahlo created vibrant, surreal self-portraits exploring identity, heritage, and physical resilience."
  },
  {
    text: "Who composed the dramatic 'Symphony No. 5 in C minor', Op. 67 with its famous four-note opening motif?",
    options: ["Wolfgang Amadeus Mozart","Ludwig van Beethoven","Johann Sebastian Bach","Franz Schubert"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Beethoven premiered his Fifth Symphony in Vienna in 1808, opening with the iconic short-short-short-long motif."
  },
  {
    text: "Which American author wrote 'The Catcher in the Rye' featuring teenage narrator Holden Caulfield?",
    options: ["J.D. Salinger","Jack Kerouac","Kurt Vonnegut","John Updike"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "J.D. Salinger published 'The Catcher in the Rye' in 1951, capturing adolescent alienation."
  },
  {
    text: "What art movement was founded by Claude Monet's 1872 painting 'Impression, Sunrise'?",
    options: ["Cubism","Impressionism","Surrealism","Fauvism"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Critic Louis Leroy coined the term 'Impressionism' mockingly after viewing Monet's 'Impression, Sunrise'."
  },
  {
    text: "Who wrote 'One Hundred Years of Solitude', the masterpiece of magical realism published in 1967?",
    options: ["Jorge Luis Borges","Gabriel García Márquez","Mario Vargas Llosa","Isabel Allende"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Colombian Nobel laureate Gabriel García Márquez chronicled seven generations of the Buendía family in Macondo."
  },
  {
    text: "Which ancient Greek philosopher was the student of Socrates and the teacher of Aristotle?",
    options: ["Plato","Epicurus","Zeno","Pythagoras"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Plato founded the Academy in Athens and authored famous dialogues including 'The Republic'."
  },
  {
    text: "Who composed the Four Seasons ('Le quattro stagioni'), a set of four violin concertos?",
    options: ["Antonio Vivaldi","George Frideric Handel","Johann Sebastian Bach","Arcangelo Corelli"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Antonio Vivaldi published 'The Four Seasons' in 1725, evoking the sounds of storms, birds, and harvests."
  },
  {
    text: "Which 19th-century English poet wrote 'Ode to a Nightingale' and 'Ode on a Grecian Urn'?",
    options: ["Lord Byron","John Keats","Percy Bysshe Shelley","William Wordsworth"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "medium",
    explanation: "John Keats composed his greatest Romantic odes in 1819 before his tragic death at age 25."
  },
  {
    text: "In Leonardo da Vinci's iconic fresco 'The Last Supper', which apostle is depicted clutching a bag of silver?",
    options: ["Peter","John","Judas Iscariot","Thomas"],
    correctIndex: 2,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Judas Iscariot is shown recoiled in shadow in Santa Maria delle Grazie, holding the bag containing his betrayal bounty."
  },
  {
    text: "Who wrote the play 'A Doll's House' in 1879, challenging 19th-century marriage norms with character Nora Helmer?",
    options: ["Henrik Ibsen","Anton Chekhov","August Strindberg","George Bernard Shaw"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "medium",
    explanation: "Norwegian playwright Henrik Ibsen provoked international debate when Nora famously slams the door on her marriage."
  },
  {
    text: "What famous surrealist painted 'The Son of Man' depicting a man in a bowler hat with a green apple hiding his face?",
    options: ["René Magritte","Max Ernst","Giorgio de Chirico","Yves Tanguy"],
    correctIndex: 0,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Belgian surrealist René Magritte painted 'The Son of Man' in 1964 as a self-portrait."
  },
  {
    text: "Which Irish novelist wrote 'Ulysses', following Leopold Bloom through Dublin on June 16, 1904?",
    options: ["Oscar Wilde","James Joyce","Samuel Beckett","W.B. Yeats"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "James Joyce's modernist masterpiece 'Ulysses' parallels Homer's Odyssey across a single day in Dublin (Bloomsday)."
  },
  {
    text: "Which Austrian composer died in 1791 at age 35, leaving his famous 'Requiem in D minor' unfinished?",
    options: ["Franz Joseph Haydn","Wolfgang Amadeus Mozart","Franz Liszt","Johannes Brahms"],
    correctIndex: 1,
    category: "Arts & Literature",
    difficulty: "easy",
    explanation: "Mozart was dictating parts of the Requiem on his deathbed; his student Franz Xaver Süssmayr completed the score."
  }
];
