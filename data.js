window.LASU_DATA = {
  storageKey: "lasu-connect-student-admin-v2",
  adminUsers: [],
  faculties: [
    "Allied Health Sciences",
    "Arts",
    "Basic Medical Sciences",
    "Clinical Sciences",
    "Computing and Information Technology",
    "Dentistry",
    "Education",
    "Engineering",
    "Environmental Sciences",
    "Law",
    "Management Sciences",
    "Science",
    "Social Sciences",
    "Transport"
  ],
  facultyDepartments: {
    "Allied Health Sciences": [
      "Nursing",
      "Physiotherapy",
      "Medical Laboratory Science",
      "Radiography and Radiation Science"
    ],
    "Arts": [
      "English Language",
      "History and International Studies",
      "Philosophy",
      "Religious Studies",
      "Linguistics, African and Asian Studies",
      "Music",
      "Theatre Arts"
    ],
    "Basic Medical Sciences": [
      "Anatomy",
      "Physiology",
      "Biochemistry"
    ],
    "Clinical Sciences": [
      "Medicine and Surgery"
    ],
    "Computing and Information Technology": [
      "Computer Science",
      "Information and Communication Technology"
    ],
    "Dentistry": [
      "Dentistry"
    ],
    "Education": [
      "Educational Management",
      "Educational Technology",
      "Guidance and Counselling",
      "Human Kinetics, Sports and Health Education",
      "Science and Technology Education",
      "Arts and Social Science Education",
      "Language Arts and Social Studies Education"
    ],
    "Engineering": [
      "Chemical and Polymer Engineering",
      "Electronics and Computer Engineering",
      "Mechanical Engineering"
    ],
    "Environmental Sciences": [
      "Architecture",
      "Building",
      "Estate Management",
      "Fine Arts",
      "Urban and Regional Planning"
    ],
    "Law": [
      "Private and Property Law",
      "Public Law",
      "Commercial and Industrial Law",
      "Jurisprudence and International Law",
      "Islamic Law"
    ],
    "Management Sciences": [
      "Accounting",
      "Banking and Finance",
      "Business Administration",
      "Insurance",
      "Public Administration"
    ],
    "Science": [
      "Biochemistry",
      "Botany",
      "Chemistry",
      "Fisheries",
      "Mathematics",
      "Microbiology",
      "Physics",
      "Science Laboratory Technology",
      "Zoology"
    ],
    "Social Sciences": [
      "Economics",
      "Geography and Planning",
      "Political Science",
      "Psychology",
      "Sociology"
    ],
    "Transport": [
      "Transport Management and Operations",
      "Transport Planning and Policy",
      "Transport Technology and Infrastructure"
    ]
  },
  students: [
    {
      id: "stu-001",
      name: "Adebayo Ibrahim",
      matricNo: "21/0412",
      level: "400",
      faculty: "Computing and Information Technology",
      department: "Computer Science",
      initials: "AI"
    },
    {
      id: "stu-002",
      name: "Hassan Mariam",
      matricNo: "22/1189",
      level: "300",
      faculty: "Computing and Information Technology",
      department: "Computer Science",
      initials: "HM"
    },
    {
      id: "stu-003",
      name: "Olawale Precious",
      matricNo: "23/2044",
      level: "200",
      faculty: "Management Sciences",
      department: "Business Administration",
      initials: "OP"
    }
  ],
  roles: {
    student: {
      label: "Student",
      tagline: "Timetable, navigation, complaints, and updates in one student portal.",
      greeting: "Good morning, Student",
      description: "Your dashboard is filtered by level and department so you only see the timetable, announcements, and alerts that belong to you.",
      primaryAction: { label: "View your timetable", target: "timetable" },
      actions: [
        { title: "View timetable", detail: "See courses assigned to your level and department.", target: "timetable" },
        { title: "Campus map", detail: "Find lecture venues and service points quickly.", target: "map" },
        { title: "Report issue", detail: "Submit academic or facility complaints.", target: "report" },
        { title: "Check alerts", detail: "Read timetable updates and admin announcements.", target: "notifications" }
      ],
      reportPanel: {
        title: "Submit a complaint",
        description: "Students can submit academic, facility, security, or crowd-related complaints with optional image evidence.",
        meta: [
          { title: "Your role", detail: "Create complaints and track feedback on your own submissions." },
          { title: "Feedback", detail: "Admin updates trigger notification messages automatically." }
        ]
      }
    },
    admin: {
      label: "Admin",
      tagline: "Manage timetable, review complaints, and publish important student updates.",
      greeting: "Good morning, Admin",
      description: "You manage the academic complaint workflow, timetable records, and announcements from one simplified control panel.",
      primaryAction: { label: "Open admin report queue", target: "report" },
      actions: [
        { title: "Manage timetable", detail: "Create and update timetable entries by level and department.", target: "timetable" },
        { title: "Review reports", detail: "Respond to submitted complaints and change their status.", target: "report" },
        { title: "Broadcast updates", detail: "Send announcements that become student notifications.", target: "notifications" },
        { title: "Check profile", detail: "Review current access scope and permissions.", target: "profile" }
      ],
      reportPanel: {
        title: "Administrative complaint desk",
        description: "Admin reviews complaints, updates resolution status, provides responses, and can broadcast important incidents to affected students.",
        meta: [
          { title: "Your role", detail: "Monitor complaint categories, respond to students, and maintain administrative transparency." },
          { title: "Broadcasts", detail: "Important report responses can be promoted to notifications." }
        ]
      }
    }
  },
  levels: ["100", "200", "300", "400", "500", "600"],
  semesters: ["First Semester", "Second Semester"],
  defaultSemester: "First Semester",
  departments: [
    "Nursing",
    "Physiotherapy",
    "Medical Laboratory Science",
    "Radiography and Radiation Science",
    "English Language",
    "History and International Studies",
    "Philosophy",
    "Religious Studies",
    "Linguistics, African and Asian Studies",
    "Music",
    "Theatre Arts",
    "Anatomy",
    "Physiology",
    "Biochemistry",
    "Medicine and Surgery",
    "Computer Science",
    "Information and Communication Technology",
    "Dentistry",
    "Educational Management",
    "Educational Technology",
    "Guidance and Counselling",
    "Human Kinetics, Sports and Health Education",
    "Science and Technology Education",
    "Arts and Social Science Education",
    "Language Arts and Social Studies Education",
    "Chemical and Polymer Engineering",
    "Electronics and Computer Engineering",
    "Mechanical Engineering",
    "Architecture",
    "Building",
    "Estate Management",
    "Fine Arts",
    "Urban and Regional Planning",
    "Private and Property Law",
    "Public Law",
    "Commercial and Industrial Law",
    "Jurisprudence and International Law",
    "Islamic Law",
    "Accounting",
    "Banking and Finance",
    "Business Administration",
    "Insurance",
    "Public Administration",
    "Botany",
    "Chemistry",
    "Fisheries",
    "Mathematics",
    "Microbiology",
    "Physics",
    "Science Laboratory Technology",
    "Zoology",
    "Economics",
    "Geography and Planning",
    "Political Science",
    "Psychology",
    "Sociology",
    "Transport Management and Operations",
    "Transport Planning and Policy",
    "Transport Technology and Infrastructure"
  ],
  timetable: [
    { id: 1, day: "Monday", courseCode: "CSC 409", courseTitle: "Software Engineering", start: "10:00", end: "12:00", location: "Lecture Hall A", level: "400", semester: "First Semester", faculty: "Computing and Information Technology", department: "Computer Science", updatedAt: "2026-04-29" },
    { id: 2, day: "Monday", courseCode: "GST 302", courseTitle: "Communication in English", start: "12:00", end: "13:00", location: "Main Auditorium", level: "300", semester: "First Semester", faculty: "Computing and Information Technology", department: "Computer Science", updatedAt: "2026-04-29" },
    { id: 3, day: "Tuesday", courseCode: "CSC 317", courseTitle: "Operating Systems", start: "09:00", end: "11:00", location: "Faculty of Science Lab 2", level: "300", semester: "First Semester", faculty: "Computing and Information Technology", department: "Computer Science", updatedAt: "2026-04-30" },
    { id: 4, day: "Wednesday", courseCode: "BUS 214", courseTitle: "Business Statistics", start: "11:00", end: "13:00", location: "Senate Building Room 4", level: "200", semester: "First Semester", faculty: "Management Sciences", department: "Business Administration", updatedAt: "2026-04-30" },
    { id: 5, day: "Thursday", courseCode: "CSC 411", courseTitle: "Compiler Construction", start: "14:00", end: "16:00", location: "Innovation Hub", level: "400", semester: "Second Semester", faculty: "Computing and Information Technology", department: "Computer Science", updatedAt: "2026-05-01" },
    { id: 6, day: "Friday", courseCode: "CSC 499", courseTitle: "Project Seminar", start: "08:00", end: "10:00", location: "Lecture Hall A", level: "400", semester: "Second Semester", faculty: "Computing and Information Technology", department: "Computer Science", updatedAt: "2026-05-01" }
  ],
  issueTypes: ["Academic issue", "Facility issue", "Security issue", "Crowd issue"],
  reports: [
    {
      id: 1001,
      studentId: "stu-001",
        studentFaculty: "Computing and Information Technology",
        studentDepartment: "Computer Science",
        studentLevel: "400",
        studentSemester: "Second Semester",
        studentMatric: "21/0412",
      type: "Facility issue",
      location: "Main Library",
      description: "The reading hall lights are flickering on the second floor.",
      imageName: "library-lights.jpg",
      status: "Under review",
      adminResponse: "Maintenance has been informed and inspection is scheduled.",
      broadcast: false,
      createdAt: "2026-04-29 08:10"
    },
    {
      id: 1002,
      studentId: "stu-001",
        studentFaculty: "Computing and Information Technology",
        studentDepartment: "Computer Science",
        studentLevel: "400",
        studentSemester: "Second Semester",
        studentMatric: "21/0412",
      type: "Academic issue",
      location: "Lecture Hall A",
      description: "Projector failed during CSC 409 class and the lecture ended early.",
      imageName: "",
      status: "Resolved",
      adminResponse: "A replacement projector has been deployed and faculty informed.",
      broadcast: true,
      createdAt: "2026-04-30 10:25"
    },
    {
      id: 1003,
      studentId: "stu-003",
        studentFaculty: "Management Sciences",
        studentDepartment: "Business Administration",
        studentLevel: "200",
        studentSemester: "First Semester",
        studentMatric: "23/2044",
      type: "Crowd issue",
      location: "Senate Building",
      description: "Registration queue management is poor and students are pushing.",
      imageName: "queue-scene.png",
      status: "Pending",
      adminResponse: "",
      broadcast: false,
      createdAt: "2026-05-01 09:05"
    }
  ],
  announcements: [
    {
      id: 1,
      title: "Exam timetable updated",
        message: "Campus exam timetable updates are now available for students who need the latest seating details.",
        audienceLevel: "all",
        audienceFaculty: "all",
        audienceDepartment: "all",
        audienceSemester: "all",
        createdAt: "2026-04-30 16:00"
      },
    {
      id: 2,
      title: "CSC timetable adjustment",
        message: "CSC 411 on Thursday now starts at 2:00 PM in the Innovation Hub.",
        audienceLevel: "400",
        audienceFaculty: "Computing and Information Technology",
        audienceDepartment: "Computer Science",
        audienceSemester: "Second Semester",
        createdAt: "2026-05-01 08:00"
      }
  ],
  locations: [
    { name: "Senate Building", zone: "Administrative & High-Tech Core", lat: 6.471512, lng: 3.2000247, nextStop: "Senate gate", summary: "Administrative core and senate offices.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "DICT / ICT Centre", zone: "Administrative & High-Tech Core", lat: 6.4686855, lng: 3.2011387, nextStop: "ICT main entrance", summary: "Digital and ICT support center.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Awori House (Innovation Centre)", zone: "Administrative & High-Tech Core", lat: 6.4656524, lng: 3.2003632, nextStop: "Innovation lobby", summary: "Innovation and startup support facility.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Multimedia Centre (LASU Radio)", zone: "Administrative & High-Tech Core", lat: 6.4710874, lng: 3.1999216, nextStop: "Radio studio wing", summary: "Campus multimedia and radio services.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },

    { name: "New Library CBT Centre", zone: "Official CBT & Exam Venues", lat: 6.4750409, lng: 3.2013593, nextStop: "CBT access point", summary: "Computer-based testing center near the new library.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "LASU CBT Centre", zone: "Official CBT & Exam Venues", lat: 6.4750409, lng: 3.2013593, nextStop: "CBT main door", summary: "Official LASU CBT venue for exams.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "2,000-Capacity CBT Centre", zone: "Official CBT & Exam Venues", lat: 6.4750409, lng: 3.2013593, nextStop: "Large CBT forecourt", summary: "High-capacity CBT and exam complex.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "DICT Exam Hall", zone: "Official CBT & Exam Venues", lat: 6.4686855, lng: 3.2011387, nextStop: "DICT exam corridor", summary: "Exam hall within the DICT complex.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },

    { name: "Sanwo-Olu Library (New)", zone: "Academic Faculties & Specialized Wings", lat: 6.464094, lng: 3.2001951, nextStop: "New library entrance", summary: "Main new library and reading areas.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Fatiu Akesode Library (Old)", zone: "Academic Faculties & Specialized Wings", lat: 6.474091, lng: 3.201853, nextStop: "Old library front", summary: "Legacy library facility and study spaces.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "Faculty of Science", zone: "Academic Faculties & Specialized Wings", lat: 6.475036, lng: 3.202078, nextStop: "Science corridor", summary: "Faculty block for science departments.", popular: true, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "Faculty of Management Sciences (FMS)", zone: "Academic Faculties & Specialized Wings", lat: 6.472331, lng: 3.203782, nextStop: "FMS frontage", summary: "Faculty complex for management disciplines.", popular: true, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "ENT Building", zone: "Academic Faculties & Specialized Wings", lat: 6.474128, lng: 3.198763, nextStop: "ENT frontage", summary: "ENT academic building.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "ACEITSE Building", zone: "Academic Faculties & Specialized Wings", lat: 6.4759256, lng: 3.1989021, nextStop: "ACEITSE entrance", summary: "ACEITSE academic and research facility.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Faculty of Education", zone: "Academic Faculties & Specialized Wings", lat: 6.4729982, lng: 3.1998683, nextStop: "Education quadrangle", summary: "Faculty offices and lecture venues for education.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Faculty of Law & Clinic", zone: "Academic Faculties & Specialized Wings", lat: 6.4669577, lng: 3.2022538, nextStop: "Law clinic front desk", summary: "Law faculty and legal clinic complex.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Faculty of Arts / Social Sciences", zone: "Academic Faculties & Specialized Wings", lat: 6.473972, lng: 3.199625, nextStop: "Arts and social sciences wing", summary: "Shared faculty zone for arts and social sciences.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "School of Transport & Communication", zone: "Academic Faculties & Specialized Wings", lat: 6.4742738, lng: 3.1980513, nextStop: "Transport school gate", summary: "School focused on transport and communication studies.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },

    { name: "ECO Market", zone: "Markets & Eateries", lat: 6.4644371, lng: 3.2036673, nextStop: "ECO market lane", summary: "Student convenience market area.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "AJ Market (Science Market)", zone: "Markets & Eateries", lat: 6.474816, lng: 3.201326, nextStop: "Science market stalls", summary: "Popular market area near science facilities.", popular: true, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "Student Arcade", zone: "Markets & Eateries", lat: 6.4657737, lng: 3.203035, nextStop: "Arcade storefront", summary: "Student commercial and food arcade.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Education Market", zone: "Markets & Eateries", lat: 6.473927, lng: 3.200864, nextStop: "Education market row", summary: "Market cluster serving the education zone.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "FMS Market", zone: "Markets & Eateries", lat: 6.472637, lng: 3.203755, nextStop: "FMS market line", summary: "Market area around FMS buildings.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "ASUU Cooperative Supermarket", zone: "Markets & Eateries", lat: 6.473946, lng: 3.199319, nextStop: "Cooperative storefront", summary: "ASUU cooperative retail supermarket.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },

    { name: "Buba Marwa Auditorium", zone: "Ceremonial & Social Landmarks", lat: 6.473172, lng: 3.201933, nextStop: "Auditorium main entrance", summary: "Major auditorium for events and large classes.", popular: true, verified: true, verifiedSource: "osm_way_1273141548" },
    { name: "Adejoke Orelope Auditorium", zone: "Ceremonial & Social Landmarks", lat: 6.4731078, lng: 3.2019333, nextStop: "Orelope entrance", summary: "Ceremonial and lecture auditorium.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Aderemi Makanjuola Theatre", zone: "Ceremonial & Social Landmarks", lat: 6.466227, lng: 3.2008787, nextStop: "Theatre forecourt", summary: "Performance theatre and event space.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Love Garden", zone: "Ceremonial & Social Landmarks", lat: 6.4789094, lng: 3.1957606, nextStop: "Garden walkway", summary: "Social relaxation garden for students.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Innovation Hall", zone: "Ceremonial & Social Landmarks", lat: 6.4656524, lng: 3.2003632, nextStop: "Innovation hall foyer", summary: "Multipurpose innovation and event hall.", popular: false, verified: true, verifiedSource: "google_maps_tbm_search" },

    { name: "Health Centre", zone: "Health, Sports & Residential", lat: 6.4653866, lng: 3.2016866, nextStop: "Health reception", summary: "Primary campus health services center.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "Okoya-Thomas Sports Hall", zone: "Health, Sports & Residential", lat: 6.473653, lng: 3.203897, nextStop: "Sports hall entrance", summary: "Indoor sports and fitness complex.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "1,500 Bed-Space Hostel Site", zone: "Health, Sports & Residential", lat: 6.473086, lng: 3.198314, nextStop: "Hostel access road", summary: "Large student hostel development site.", popular: false, verified: false, verifiedSource: "transformed_from_provided_list" },
    { name: "LASU Central Mosque", zone: "Health, Sports & Residential", lat: 6.465436, lng: 3.1999755, nextStop: "Mosque courtyard", summary: "Central mosque serving campus community.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" },
    { name: "LASU Chapel", zone: "Health, Sports & Residential", lat: 6.4674816, lng: 3.1987259, nextStop: "Chapel entrance", summary: "Campus chapel for worship and fellowship.", popular: true, verified: true, verifiedSource: "google_maps_tbm_search" }
  ],
  defaultPreferences: {
    notifications: true,
    reminders: true
  }
};






