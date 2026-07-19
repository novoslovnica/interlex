export const APP_VERSION = "4.3"

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  titleIsv: string
  features: { isv: string; ru: string }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "4.0",
    date: "2026-06",
    title: "Prvypust / Первый выпуск",
    titleIsv: "Prvypust platformy",
    features: [
      { isv: "Parsing i strukturizacija dannyh iz věrověrnyh slovnikov", ru: "Парсинг и структурирование данных из авторитетных словарей" },
      { isv: "Pohod za slovom s perevodom na 16 jezykov v realnom vremeni", ru: "Поиск по словарю с переводом на 16 языков в реальном времени" },
      { isv: "Administrativna tablica dlja upravlenja perevodami", ru: "Административная панель для управления переводами" },
      { isv: "Upravlenje sinonimami, antonimami i odnorodnymi slovami", ru: "Управление синонимами, антонимами и однокоренными словами" },
      { isv: "Polnaja gramatičeskaja paradigma: sklonenja, spreženja, stupeni porovnanja", ru: "Полная грамматическая парадигма: склонения, спряжения, степени сравнения" },
      { isv: "Podderžka latinskogo i kiričeskogo pisma s dinamičeskim prěključenjem", ru: "Поддержка латинского и кириллического письма с динамическим переключением" },
    ],
  },
  {
    version: "4.1",
    date: "2026-07",
    title: "Flavorizacija i sintaksičeskyje otnošenja / Флаворизация и синтаксические отношения",
    titleIsv: "Razširenje leksičeskoj seti",
    features: [
      { isv: "Učet flavorizacij (Latinica / Kirilica) i izbornik pisma v tekstah", ru: "Учет флаворизаций (Latinica / Kirilica) и выбор письма в текстах" },
      { isv: "9 novyh tipov otnošenij medžu slovami iz sinθsetov (synset relations)", ru: "9 новых типов отношений между словами из синсетов" },
      { isv: "Variativnost fleksij i rasširenyje morfologičeskije pravila", ru: "Вариативность флексий и расширенные морфологические правила" },
      { isv: "Markery verifikacii i sistema odobrenja izměnenij", ru: "Маркеры верификации и система одобрения изменений" },
      { isv: "Polnaja istorija izměnenij (action history) dlja leksem i morfem", ru: "Полная история изменений (action history) для лексем и морфем" },
      { isv: "Obogatili vněšnije dannyje i etimologičeskije svazy", ru: "Обогатили внешние данные и этимологические связи" },
    ],
  },
  {
    version: "4.2",
    date: "2026-07",
    title: "Sbornik tekstov / Библиотека текстов",
    titleIsv: "Biblioteka tekstov na medžuslovjanskom",
    features: [
      { isv: "Dodavaje biblioteky tekstov s admin-panelju", ru: "Добавление библиотеки текстов с админ-панелью" },
      { isv: "Markdown-format i bogatoje formatirovanje tekstov", ru: "Markdown-формат и богатое форматирование текстов" },
      { isv: "Pohod i filtracyja tekstov po kategorijam", ru: "Поиск и фильтрация текстов по категориям" },
      { isv: "Slug-sistema i čitablnyje URL", ru: "Slug-система и читаемые URL" },
      { isv: "Učet vkladow (kto dobavil tekst) i istorija izměnenij", ru: "Учет вкладов (кто добавил текст) и история изменений" },
      { isv: "Metadannyje: istočnik, god napisanja, prevod, flavorizacija (CORE/NSL/EAST/WEST/SOUTH)", ru: "Метаданные: источник, год написания, перевод, флаворизация (CORE/NSL/EAST/WEST/SOUTH)" },
      { isv: "Obkladky i audio fajly dlja tekstov biblioteky", ru: "Обложки и аудиофайлы для текстов библиотеки" },
      { isv: "Sredneje vreme čtenja i količestvo stránic tekstov", ru: "Среднее время чтения и количество страниц текстов" },
      { isv: "Vypravlenje sklonenij slov (věrifikacija paradigm)", ru: "Выверка склонений слов (верификация парадигм)" },
      { isv: "Pohod po kategorijam slov (časti reči, rod, číslo)", ru: "Поиск по категориям слов (части речи, род, число)" },
    ],
  },
  {
    version: "4.3",
    date: "2026-07",
    title: "Korpus i gramatičesky parser / Корпус и грамматический парсер",
    titleIsv: "Sozdanije korpusa i POS-tagging",
    features: [
      { isv: "Gramatičesky parser s POS-tagging (razměčanje častej reči)", ru: "Грамматический парсер POS-tagging (разметка частей речи)" },
      { isv: "Sozdanije bazy dannyh korpusa", ru: "Создание базы данных корпуса" },
      { isv: "Načalo napolnjenja korpusa tekstami", ru: "Начало наполнения корпуса текстами" },
      { isv: "Video (YouTube) v tekstah biblioteky", ru: "Отображение видео (YouTube) в текстах библиотеки" },
      { isv: "Vlastny imena s velikoj bukvy (kapitalizacija)", ru: "Отображение собственных имён с большой буквы" },
    ],
  },
]