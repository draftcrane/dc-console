/**
 * Generate test fixtures for the content chunking spike (#136).
 *
 * Creates 5 fixture sets:
 *   1. Small (3 sources, ~5K words) — distinct topics, clear ground truth
 *   2. Medium (10 sources, ~50K words) — overlapping themes
 *   3. Large (25 sources, ~200K words) — stress test
 *   4. PDF-sourced (flat <p>-only HTML via textToHtml pattern)
 *   5. DOCX-sourced (structured HTML with headings/lists/tables)
 *
 * Plus 24 ground-truth evaluation queries.
 *
 * Usage:
 *   npx tsx scripts/generate-chunking-fixtures.ts
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures/chunking-spike");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceFixture {
  id: string;
  title: string;
  html: string;
  wordCount: number;
  /** "structured" = has headings (DOCX/MD), "flat" = all <p> (PDF) */
  htmlType: "structured" | "flat";
}

export interface FixtureSet {
  name: string;
  sources: SourceFixture[];
}

export interface GroundTruthQuery {
  id: string;
  query: string;
  type: "keyword" | "paraphrase" | "multi-source" | "negative";
  /** Source IDs that contain the answer (empty for negative queries) */
  expectedSourceIds: string[];
  /** Key phrases that should appear in correct retrieval results */
  expectedPhrases: string[];
}

// ---------------------------------------------------------------------------
// Content generation helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text
    .replace(/<[^>]+>/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Wrap plain text as flat <p> HTML (mimics textToHtml from source-local.ts) */
function textToFlatHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0)
    .map(
      (p) =>
        `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()}</p>`,
    )
    .join("\n");
}

/** Generate a paragraph with ~targetWords words on a given topic */
function generateParagraph(topic: string, targetWords: number): string {
  const sentences: Record<string, string[]> = {
    leadership: [
      "Effective leadership requires a combination of vision, empathy, and decisive action.",
      "Leaders who demonstrate vulnerability often build stronger teams than those who project invincibility.",
      "According to Goleman (1995), emotional intelligence accounts for nearly 90 percent of what distinguishes star performers from average ones.",
      "The transformational leadership model emphasizes inspiring followers through a shared vision rather than relying on transactional reward systems.",
      '"I learned more about leadership from my failures than from any textbook," noted General Powell in his 2012 memoir.',
      "Servant leadership, first articulated by Robert K. Greenleaf in 1970, prioritizes the growth and well-being of team members above all else.",
      "A meta-analysis of 87 studies (Judge et al., 2002) found that conscientiousness and extraversion were the strongest personality predictors of leadership effectiveness.",
      "The distinction between management and leadership remains one of the most debated topics in organizational psychology.",
      "Cross-cultural leadership research reveals that humility is valued as a leadership trait in collectivist cultures but may be perceived as weakness in individualist contexts.",
      "Digital transformation has created demand for leaders who can navigate ambiguity and rapid technological change simultaneously.",
    ],
    research_methods: [
      "Qualitative research methods provide rich, contextual data that quantitative approaches often miss.",
      "The grounded theory approach, developed by Glaser and Strauss (1967), builds theory inductively from systematic data analysis.",
      "Triangulation — using multiple data sources, methods, or researchers — strengthens the credibility of qualitative findings.",
      "Semi-structured interviews allow researchers to explore unexpected themes while maintaining a consistent framework across participants.",
      "Phenomenological analysis seeks to understand the lived experience of participants, bracketing the researcher's preconceptions.",
      "The sample size in qualitative research is determined by data saturation rather than statistical power calculations.",
      "Coding reliability can be assessed through inter-rater agreement metrics such as Cohen's kappa (Cohen, 1960).",
      "Mixed-methods research designs combine qualitative depth with quantitative breadth, though they require expertise in both paradigms.",
      '"The purpose of qualitative inquiry is not to generalize but to illuminate the particular," wrote Patton (2002, p. 46).',
      "Ethnographic fieldwork demands extended immersion in the research context, typically spanning months or years.",
    ],
    organizational_change: [
      "Kurt Lewin's three-stage model of change — unfreeze, change, refreeze — remains foundational despite criticism of its linearity.",
      "Resistance to change is not inherently irrational; it often reflects legitimate concerns about job security, competence, and identity.",
      "Kotter's eight-step process for leading change (1996) begins with creating a sense of urgency and building a guiding coalition.",
      "Organizational culture, defined by Schein (2010) as shared basic assumptions, is both the greatest enabler and the greatest barrier to change.",
      "Change fatigue occurs when employees experience too many concurrent or overlapping change initiatives, leading to disengagement and cynicism.",
      "The psychological contract between employer and employee is frequently violated during major organizational restructuring.",
      "Appreciative inquiry offers an alternative to deficit-based change models by focusing on what works well and amplifying those strengths.",
      '"People don\'t resist change. They resist being changed," observed Peter Senge in The Fifth Discipline (1990).',
      "Middle managers play a critical role in translating strategic change initiatives into operational reality, yet they are often overlooked in change planning.",
      "Digital transformation efforts fail at rates between 60 and 85 percent, according to multiple McKinsey studies (2018-2023).",
    ],
    data_analysis: [
      "Regression analysis assumes a linear relationship between independent and dependent variables, which may not hold in complex systems.",
      "The p-value threshold of 0.05, while widely used, is an arbitrary convention that has been increasingly questioned by statisticians (Wasserstein & Lazar, 2016).",
      "Effect sizes provide practical significance information that p-values alone cannot convey.",
      "Bayesian analysis offers an alternative framework that incorporates prior knowledge and yields probability distributions rather than point estimates.",
      "Principal component analysis (PCA) reduces high-dimensional data to a smaller set of uncorrelated variables while preserving maximum variance.",
      "Survival analysis techniques, including Kaplan-Meier curves and Cox proportional hazards models, are essential for time-to-event data.",
      "The assumption of normally distributed residuals should be verified through Q-Q plots and formal tests such as Shapiro-Wilk.",
      "Machine learning algorithms like random forests and gradient boosting can capture nonlinear relationships that traditional regression misses.",
      "Multicollinearity among predictor variables inflates standard errors and makes individual coefficient estimates unreliable.",
      "Cross-validation partitions the dataset into training and test sets to assess model generalization performance.",
    ],
    interview_techniques: [
      '"Tell me about a time when you faced a significant challenge at work," I began the interview with candidate #14.',
      'The interviewee paused for several seconds before responding: "Honestly, the hardest thing was admitting I didn\'t have the answer."',
      "Active listening during interviews requires the researcher to resist the urge to interpret or redirect too quickly.",
      "Rapport-building techniques include mirroring body language, maintaining appropriate eye contact, and using the participant's name.",
      'Probe questions such as "Can you tell me more about that?" and "What happened next?" elicit richer narratives than closed-ended questions.',
      '"I never expected the conversation to go in that direction," reflected Dr. Maria Santos in her research journal entry from March 2019.',
      "Recording interviews with participant consent allows for accurate transcription and reduces note-taking distraction.",
      "Member checking — sharing transcripts or interpretations with participants for validation — enhances the trustworthiness of qualitative data.",
      "Cultural sensitivity in cross-cultural interviews extends beyond language translation to include awareness of power dynamics and social norms.",
      "Focus groups generate data through participant interaction, revealing shared meanings and social dynamics that individual interviews cannot capture.",
    ],
    project_management: [
      "The PMBOK Guide identifies five process groups: initiating, planning, executing, monitoring and controlling, and closing.",
      "Agile methodologies prioritize responding to change over following a plan, as stated in the Agile Manifesto (Beck et al., 2001).",
      "Earned value management (EVM) integrates scope, schedule, and cost measurements to assess project performance and forecast completion.",
      "The critical path method identifies the longest sequence of dependent tasks, determining the minimum project duration.",
      "Risk registers document identified risks, their probability, impact, and planned mitigation strategies.",
      "Stakeholder analysis maps individuals and groups by their influence and interest, guiding engagement strategies.",
      "Scope creep — the uncontrolled expansion of project scope — is the most frequently cited cause of project failure.",
      "Sprint retrospectives in Scrum provide a structured mechanism for continuous process improvement.",
      "Resource leveling adjusts the project schedule to resolve resource overallocation, often extending the overall timeline.",
      "Communication management plans specify what information will be shared, with whom, how frequently, and through which channels.",
    ],
    coaching_psychology: [
      "The GROW model (Goal, Reality, Options, Will) provides a structured framework for coaching conversations.",
      "Positive psychology coaching focuses on leveraging client strengths rather than remedying deficits.",
      "Motivational interviewing, originally developed for addiction treatment, has been adapted for executive coaching contexts.",
      "Self-determination theory (Deci & Ryan, 2000) identifies autonomy, competence, and relatedness as fundamental psychological needs.",
      "The coaching alliance — the quality of the relationship between coach and client — is the strongest predictor of coaching outcomes.",
      "360-degree feedback instruments collect performance data from supervisors, peers, direct reports, and the individual being assessed.",
      "Cognitive behavioral coaching applies CBT principles to help clients identify and restructure unhelpful thought patterns.",
      '"What would success look like for you?" is perhaps the most powerful question a coach can ask, according to Whitmore (2009).',
      "Reflective practice involves systematic examination of one's own professional actions and their underlying assumptions.",
      "Coaching supervision, though underutilized, helps coaches maintain objectivity and manage the emotional demands of their work.",
    ],
    team_dynamics: [
      "Tuckman's model describes four stages of group development: forming, storming, norming, and performing (1965).",
      "Psychological safety, defined by Edmondson (1999), enables team members to take interpersonal risks without fear of punishment.",
      "Google's Project Aristotle found that psychological safety was the most important factor distinguishing high-performing teams.",
      "Social loafing — reduced individual effort in groups — increases with group size and decreases with task meaningfulness.",
      "Groupthink occurs when the desire for consensus overrides realistic appraisal of alternatives, often leading to poor decisions.",
      "Cross-functional teams bring diverse expertise but face coordination challenges due to different professional languages and priorities.",
      "Virtual team effectiveness depends on establishing clear communication norms and building trust through consistent follow-through.",
      "Conflict in teams is not inherently destructive; task-related conflict can improve decision quality when managed constructively.",
      '"The best teams are not those that avoid conflict but those that have learned to disagree productively," observed Lencioni (2002).',
      "Team cohesion is positively correlated with performance, but excessive cohesion can lead to insularity and resistance to outside input.",
    ],
    strategic_thinking: [
      "Porter's Five Forces framework analyzes competitive intensity: threat of new entrants, buyer power, supplier power, substitutes, and rivalry.",
      "Blue ocean strategy advocates creating uncontested market space rather than competing in existing, crowded markets (Kim & Mauborgne, 2005).",
      "SWOT analysis, while widely taught, is often criticized for producing superficial observations without clear strategic implications.",
      "Scenario planning develops multiple plausible futures to test strategy robustness, rather than predicting a single outcome.",
      "The resource-based view of the firm (Barney, 1991) argues that sustainable competitive advantage derives from resources that are valuable, rare, inimitable, and non-substitutable (VRIN).",
      "Platform business models create value by facilitating exchanges between two or more interdependent user groups.",
      "Disruptive innovation, as described by Christensen (1997), initially targets overlooked market segments with simpler, cheaper alternatives.",
      "Dynamic capabilities — the ability to sense, seize, and transform — enable firms to adapt to rapidly changing environments (Teece, 2007).",
      "The balanced scorecard translates strategic objectives into measurable targets across four perspectives: financial, customer, internal process, and learning.",
      "First-mover advantage is not automatic; fast followers who learn from pioneers' mistakes often capture more value.",
    ],
    digital_transformation: [
      "Digital transformation is not merely about technology adoption; it requires fundamental changes to organizational culture and processes.",
      "Cloud computing reduces capital expenditure by converting infrastructure costs from CAPEX to OPEX through pay-as-you-go models.",
      "API-first architecture enables organizations to expose capabilities as services, fostering ecosystem integration and partner innovation.",
      'The "technology stack" for modern enterprises typically includes cloud infrastructure, data platforms, application layers, and integration middleware.',
      "Legacy system modernization strategies include: rehost (lift and shift), refactor, rearchitect, rebuild, and replace.",
      "Data governance frameworks establish policies for data quality, security, privacy, and lifecycle management across the organization.",
      "Robotic process automation (RPA) handles repetitive, rule-based tasks at 30-50% lower cost than manual processing.",
      "Customer experience (CX) design has become the primary driver of digital transformation investments since 2020.",
      "Technical debt accumulates when expedient solutions are chosen over architecturally sound ones, increasing long-term maintenance costs.",
      "DevOps practices — CI/CD pipelines, infrastructure as code, automated testing — reduce deployment frequency from months to minutes.",
    ],
  };

  const topicSentences = sentences[topic] || sentences["leadership"];
  const result: string[] = [];
  let words = 0;

  while (words < targetWords) {
    for (const sentence of topicSentences) {
      result.push(sentence);
      words += sentence.split(/\s+/).length;
      if (words >= targetWords) break;
    }
  }

  return result.join(" ");
}

/** Generate a numeric data table as HTML */
function generateDataTable(title: string, rows: [string, string, string][]): string {
  let html = `<table><thead><tr><th>Metric</th><th>Value</th><th>Notes</th></tr></thead><tbody>`;
  for (const [metric, value, notes] of rows) {
    html += `<tr><td>${metric}</td><td>${value}</td><td>${notes}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

// ---------------------------------------------------------------------------
// Fixture set generators
// ---------------------------------------------------------------------------

function generateFixture1_Small(): FixtureSet {
  const sources: SourceFixture[] = [
    {
      id: "small-leadership",
      title: "Leadership Fundamentals for Practitioners",
      htmlType: "structured",
      html: [
        "<h1>Leadership Fundamentals for Practitioners</h1>",
        "<h2>Chapter 1: The Nature of Leadership</h2>",
        `<p>${generateParagraph("leadership", 500)}</p>`,
        "<h2>Chapter 2: Emotional Intelligence in Leadership</h2>",
        `<p>${generateParagraph("leadership", 500)}</p>`,
        "<h3>Key Competencies</h3>",
        "<ul><li>Self-awareness: understanding one's own emotional triggers</li>",
        "<li>Self-regulation: managing impulses and adapting to change</li>",
        "<li>Social awareness: reading organizational dynamics</li>",
        "<li>Relationship management: inspiring and influencing others</li></ul>",
        `<p>${generateParagraph("leadership", 500)}</p>`,
        "<h2>Chapter 3: Cross-Cultural Leadership</h2>",
        `<p>${generateParagraph("leadership", 300)}</p>`,
      ].join("\n"),
      wordCount: 0,
    },
    {
      id: "small-research",
      title: "Research Methods Handbook",
      htmlType: "structured",
      html: [
        "<h1>Research Methods Handbook</h1>",
        "<h2>Part I: Qualitative Approaches</h2>",
        "<h3>Grounded Theory</h3>",
        `<p>${generateParagraph("research_methods", 600)}</p>`,
        "<h3>Phenomenological Analysis</h3>",
        `<p>${generateParagraph("research_methods", 400)}</p>`,
        "<h2>Part II: Data Collection</h2>",
        "<h3>Interview Techniques</h3>",
        `<p>${generateParagraph("interview_techniques", 500)}</p>`,
        generateDataTable("Sample Size Guidelines", [
          ["Case study", "1-5 cases", "Deep analysis"],
          ["Phenomenology", "5-25 participants", "Saturation target"],
          ["Grounded theory", "20-60 participants", "Theoretical saturation"],
          ["Ethnography", "1-2 field sites", "Extended immersion"],
        ]),
        `<p>${generateParagraph("research_methods", 300)}</p>`,
      ].join("\n"),
      wordCount: 0,
    },
    {
      id: "small-change",
      title: "Managing Organizational Change",
      htmlType: "structured",
      html: [
        "<h1>Managing Organizational Change</h1>",
        "<h2>Introduction: Why Change Fails</h2>",
        `<p>${generateParagraph("organizational_change", 600)}</p>`,
        "<h2>The Lewin Model Revisited</h2>",
        `<p>${generateParagraph("organizational_change", 500)}</p>`,
        "<h2>Kotter's Eight Steps in Practice</h2>",
        `<p>${generateParagraph("organizational_change", 500)}</p>`,
        "<h3>Implementation Checklist</h3>",
        "<ol><li>Establish urgency with data and stories</li>",
        "<li>Build a coalition of influential supporters</li>",
        "<li>Create a clear, compelling vision</li>",
        "<li>Communicate the vision repeatedly across channels</li></ol>",
        `<p>${generateParagraph("organizational_change", 200)}</p>`,
      ].join("\n"),
      wordCount: 0,
    },
  ];

  for (const s of sources) {
    s.wordCount = countWords(s.html);
  }

  return { name: "fixture-1-small", sources };
}

function generateFixture2_Medium(): FixtureSet {
  const topics = [
    { id: "med-lead-1", title: "Transformational Leadership Theory", topic: "leadership" },
    { id: "med-lead-2", title: "Servant Leadership in Practice", topic: "leadership" },
    { id: "med-research-1", title: "Qualitative Data Analysis", topic: "research_methods" },
    { id: "med-research-2", title: "Interview Protocol Design", topic: "interview_techniques" },
    { id: "med-change-1", title: "Leading Change in Healthcare", topic: "organizational_change" },
    {
      id: "med-change-2",
      title: "Digital Transformation Strategy",
      topic: "digital_transformation",
    },
    { id: "med-teams-1", title: "Building High-Performance Teams", topic: "team_dynamics" },
    { id: "med-coach-1", title: "Executive Coaching Frameworks", topic: "coaching_psychology" },
    { id: "med-strategy-1", title: "Competitive Strategy Analysis", topic: "strategic_thinking" },
    { id: "med-pm-1", title: "Agile Project Management", topic: "project_management" },
  ];

  const sources: SourceFixture[] = topics.map(({ id, title, topic }) => {
    const sections = [
      `<h1>${title}</h1>`,
      `<h2>Introduction</h2>`,
      `<p>${generateParagraph(topic, 800)}</p>`,
      `<h2>Core Concepts</h2>`,
      `<p>${generateParagraph(topic, 1000)}</p>`,
      `<h2>Practical Applications</h2>`,
      `<p>${generateParagraph(topic, 800)}</p>`,
      `<h2>Case Study Analysis</h2>`,
      `<p>${generateParagraph(topic, 800)}</p>`,
      `<h2>Conclusions and Future Directions</h2>`,
      `<p>${generateParagraph(topic, 600)}</p>`,
    ];

    const html = sections.join("\n");
    return {
      id,
      title,
      html,
      wordCount: countWords(html),
      htmlType: "structured" as const,
    };
  });

  return { name: "fixture-2-medium", sources };
}

function generateFixture3_Large(): FixtureSet {
  const topicList = [
    "leadership",
    "research_methods",
    "organizational_change",
    "data_analysis",
    "interview_techniques",
    "project_management",
    "coaching_psychology",
    "team_dynamics",
    "strategic_thinking",
    "digital_transformation",
  ];

  const sources: SourceFixture[] = [];

  for (let i = 0; i < 25; i++) {
    const topic = topicList[i % topicList.length];
    const id = `large-${i.toString().padStart(2, "0")}`;
    const title = `${topic.replace(/_/g, " ")} — Volume ${Math.floor(i / 10) + 1}, Part ${(i % 10) + 1}`;

    const sections = [
      `<h1>${title}</h1>`,
      `<h2>Overview</h2>`,
      `<p>${generateParagraph(topic, 1200)}</p>`,
      `<h2>Literature Review</h2>`,
      `<p>${generateParagraph(topic, 1500)}</p>`,
      `<h2>Methodology</h2>`,
      `<p>${generateParagraph(topic, 1200)}</p>`,
      `<h2>Findings</h2>`,
      `<p>${generateParagraph(topic, 1500)}</p>`,
      `<h2>Discussion</h2>`,
      `<p>${generateParagraph(topic, 1200)}</p>`,
      `<h2>Implications</h2>`,
      `<p>${generateParagraph(topic, 800)}</p>`,
      `<h2>References</h2>`,
      `<p>${generateParagraph(topic, 600)}</p>`,
    ];

    const html = sections.join("\n");
    sources.push({
      id,
      title,
      html,
      wordCount: countWords(html),
      htmlType: "structured",
    });
  }

  return { name: "fixture-3-large", sources };
}

function generateFixture4_PdfFlat(): FixtureSet {
  // Simulates the flat <p>-only HTML that unpdf + textToHtml produces
  const sources: SourceFixture[] = [
    {
      id: "pdf-leadership",
      title: "Leadership Research Review 2023",
      htmlType: "flat",
      html: textToFlatHtml(
        [
          "LEADERSHIP RESEARCH REVIEW 2023",
          "",
          generateParagraph("leadership", 400),
          "",
          "EMOTIONAL INTELLIGENCE AND LEADERSHIP EFFECTIVENESS",
          "",
          generateParagraph("leadership", 400),
          "",
          "CROSS-CULTURAL PERSPECTIVES",
          "",
          generateParagraph("leadership", 400),
          "",
          "FUTURE DIRECTIONS",
          "",
          generateParagraph("leadership", 300),
        ].join("\n"),
      ),
      wordCount: 0,
    },
    {
      id: "pdf-methods",
      title: "Qualitative Methods in Management Research",
      htmlType: "flat",
      html: textToFlatHtml(
        [
          "QUALITATIVE METHODS IN MANAGEMENT RESEARCH",
          "",
          generateParagraph("research_methods", 500),
          "",
          "DATA COLLECTION PROCEDURES",
          "",
          generateParagraph("interview_techniques", 500),
          "",
          "ANALYSIS FRAMEWORKS",
          "",
          generateParagraph("data_analysis", 400),
        ].join("\n"),
      ),
      wordCount: 0,
    },
    {
      id: "pdf-change",
      title: "Organizational Transformation Case Studies",
      htmlType: "flat",
      html: textToFlatHtml(
        [
          "ORGANIZATIONAL TRANSFORMATION CASE STUDIES",
          "",
          generateParagraph("organizational_change", 500),
          "",
          "CASE 1: HEALTHCARE SYSTEM REDESIGN",
          "",
          generateParagraph("organizational_change", 400),
          "",
          "CASE 2: TECHNOLOGY COMPANY PIVOT",
          "",
          generateParagraph("digital_transformation", 400),
          "",
          "COMPARATIVE ANALYSIS",
          "",
          generateParagraph("organizational_change", 300),
        ].join("\n"),
      ),
      wordCount: 0,
    },
  ];

  for (const s of sources) {
    s.wordCount = countWords(s.html);
  }

  return { name: "fixture-4-pdf-flat", sources };
}

function generateFixture5_DocxStructured(): FixtureSet {
  // Simulates the structured HTML that mammoth.js produces from DOCX files
  const sources: SourceFixture[] = [
    {
      id: "docx-coaching",
      title: "Executive Coaching Best Practices",
      htmlType: "structured",
      html: [
        "<h1>Executive Coaching Best Practices</h1>",
        "<h2>The GROW Model</h2>",
        `<p>${generateParagraph("coaching_psychology", 500)}</p>`,
        "<h2>Building the Coaching Alliance</h2>",
        `<p>${generateParagraph("coaching_psychology", 500)}</p>`,
        "<h3>Assessment Tools</h3>",
        generateDataTable("Common Assessment Instruments", [
          ["MBTI", "Personality type", "16 types"],
          ["StrengthsFinder", "Top 5 strengths", "34 themes"],
          ["360-degree", "Multi-rater feedback", "Custom competencies"],
          ["EQ-i 2.0", "Emotional intelligence", "15 subscales"],
        ]),
        `<p>${generateParagraph("coaching_psychology", 400)}</p>`,
        "<h2>Measuring Coaching Outcomes</h2>",
        `<p>${generateParagraph("coaching_psychology", 300)}</p>`,
      ].join("\n"),
      wordCount: 0,
    },
    {
      id: "docx-teams",
      title: "Team Effectiveness Research Summary",
      htmlType: "structured",
      html: [
        "<h1>Team Effectiveness Research Summary</h1>",
        "<h2>Psychological Safety</h2>",
        `<p>${generateParagraph("team_dynamics", 600)}</p>`,
        "<h2>Conflict and Performance</h2>",
        `<p>${generateParagraph("team_dynamics", 500)}</p>`,
        "<h3>Types of Team Conflict</h3>",
        "<ul><li><strong>Task conflict:</strong> Disagreements about the work itself</li>",
        "<li><strong>Relationship conflict:</strong> Interpersonal friction and tension</li>",
        "<li><strong>Process conflict:</strong> Disputes about how work should be done</li></ul>",
        `<p>${generateParagraph("team_dynamics", 400)}</p>`,
      ].join("\n"),
      wordCount: 0,
    },
    {
      id: "docx-strategy",
      title: "Strategic Planning Workbook",
      htmlType: "structured",
      html: [
        "<h1>Strategic Planning Workbook</h1>",
        "<h2>Environmental Scanning</h2>",
        `<p>${generateParagraph("strategic_thinking", 500)}</p>`,
        "<h2>Competitive Analysis</h2>",
        `<p>${generateParagraph("strategic_thinking", 500)}</p>`,
        generateDataTable("Porter's Five Forces Assessment", [
          ["Threat of new entrants", "Medium", "Low barriers in digital"],
          ["Buyer power", "High", "Many alternatives"],
          ["Supplier power", "Low", "Commodity inputs"],
          ["Threat of substitutes", "High", "Digital disruption"],
        ]),
        "<h2>Strategy Formulation</h2>",
        `<p>${generateParagraph("strategic_thinking", 400)}</p>`,
      ].join("\n"),
      wordCount: 0,
    },
  ];

  for (const s of sources) {
    s.wordCount = countWords(s.html);
  }

  return { name: "fixture-5-docx-structured", sources };
}

// ---------------------------------------------------------------------------
// Ground-truth queries
// ---------------------------------------------------------------------------

export function generateQueries(): GroundTruthQuery[] {
  return [
    // --- 6 exact keyword queries ---
    {
      id: "kw-1",
      query: "emotional intelligence star performers",
      type: "keyword",
      expectedSourceIds: ["small-leadership"],
      expectedPhrases: ["emotional intelligence", "star performers"],
    },
    {
      id: "kw-2",
      query: "grounded theory Glaser and Strauss 1967",
      type: "keyword",
      expectedSourceIds: ["small-research"],
      expectedPhrases: ["Glaser and Strauss", "1967"],
    },
    {
      id: "kw-3",
      query: "Kotter eight-step process guiding coalition",
      type: "keyword",
      expectedSourceIds: ["small-change"],
      expectedPhrases: ["eight-step process", "guiding coalition"],
    },
    {
      id: "kw-4",
      query: "Cohen's kappa inter-rater agreement",
      type: "keyword",
      expectedSourceIds: ["small-research"],
      expectedPhrases: ["Cohen's kappa", "inter-rater agreement"],
    },
    {
      id: "kw-5",
      query: "GROW model Goal Reality Options Will",
      type: "keyword",
      expectedSourceIds: ["docx-coaching"],
      expectedPhrases: ["GROW model", "Goal, Reality, Options, Will"],
    },
    {
      id: "kw-6",
      query: "psychological safety Edmondson 1999",
      type: "keyword",
      expectedSourceIds: ["docx-teams"],
      expectedPhrases: ["psychological safety", "Edmondson"],
    },
    // --- 6 paraphrase queries ---
    {
      id: "para-1",
      query: "how does showing weakness make leaders more effective",
      type: "paraphrase",
      expectedSourceIds: ["small-leadership"],
      expectedPhrases: ["vulnerability", "stronger teams"],
    },
    {
      id: "para-2",
      query: "when should qualitative researchers stop collecting data",
      type: "paraphrase",
      expectedSourceIds: ["small-research"],
      expectedPhrases: ["data saturation"],
    },
    {
      id: "para-3",
      query: "why do employees push back against organizational restructuring",
      type: "paraphrase",
      expectedSourceIds: ["small-change"],
      expectedPhrases: ["resistance to change", "job security"],
    },
    {
      id: "para-4",
      query: "using artificial intelligence for repetitive business tasks",
      type: "paraphrase",
      expectedSourceIds: ["pdf-change"],
      expectedPhrases: ["robotic process automation", "rule-based tasks"],
    },
    {
      id: "para-5",
      query: "what motivates people at a fundamental level",
      type: "paraphrase",
      expectedSourceIds: ["docx-coaching"],
      expectedPhrases: ["autonomy", "competence", "relatedness"],
    },
    {
      id: "para-6",
      query: "how does excessive agreement in groups lead to bad decisions",
      type: "paraphrase",
      expectedSourceIds: ["docx-teams"],
      expectedPhrases: ["groupthink", "consensus", "poor decisions"],
    },
    // --- 6 multi-source queries ---
    {
      id: "multi-1",
      query: "how do leadership and team dynamics interact",
      type: "multi-source",
      expectedSourceIds: ["small-leadership", "docx-teams"],
      expectedPhrases: ["leadership", "team", "psychological safety"],
    },
    {
      id: "multi-2",
      query: "research interview methods and coaching conversations",
      type: "multi-source",
      expectedSourceIds: ["small-research", "docx-coaching"],
      expectedPhrases: ["interview", "coaching"],
    },
    {
      id: "multi-3",
      query: "managing resistance during digital transformation",
      type: "multi-source",
      expectedSourceIds: ["small-change", "pdf-change"],
      expectedPhrases: ["resistance", "digital transformation"],
    },
    {
      id: "multi-4",
      query: "measuring effectiveness in coaching and team performance",
      type: "multi-source",
      expectedSourceIds: ["docx-coaching", "docx-teams"],
      expectedPhrases: ["measuring", "outcomes", "performance"],
    },
    {
      id: "multi-5",
      query: "competitive strategy and organizational change models",
      type: "multi-source",
      expectedSourceIds: ["docx-strategy", "small-change"],
      expectedPhrases: ["strategy", "change"],
    },
    {
      id: "multi-6",
      query: "qualitative and quantitative analysis approaches",
      type: "multi-source",
      expectedSourceIds: ["small-research", "pdf-methods"],
      expectedPhrases: ["qualitative", "quantitative"],
    },
    // --- 6 negative queries ---
    {
      id: "neg-1",
      query: "machine learning neural network architectures deep learning",
      type: "negative",
      expectedSourceIds: [],
      expectedPhrases: [],
    },
    {
      id: "neg-2",
      query: "quantum computing qubit entanglement error correction",
      type: "negative",
      expectedSourceIds: [],
      expectedPhrases: [],
    },
    {
      id: "neg-3",
      query: "marine biology coral reef ecosystem biodiversity",
      type: "negative",
      expectedSourceIds: [],
      expectedPhrases: [],
    },
    {
      id: "neg-4",
      query: "Renaissance painting techniques oil canvas fresco",
      type: "negative",
      expectedSourceIds: [],
      expectedPhrases: [],
    },
    {
      id: "neg-5",
      query: "cryptocurrency blockchain smart contract ethereum solidity",
      type: "negative",
      expectedSourceIds: [],
      expectedPhrases: [],
    },
    {
      id: "neg-6",
      query: "astrophysics black hole event horizon gravitational waves",
      type: "negative",
      expectedSourceIds: [],
      expectedPhrases: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });

  const fixtures: FixtureSet[] = [
    generateFixture1_Small(),
    generateFixture2_Medium(),
    generateFixture3_Large(),
    generateFixture4_PdfFlat(),
    generateFixture5_DocxStructured(),
  ];

  const queries = generateQueries();

  for (const fixture of fixtures) {
    const dir = resolve(FIXTURES_DIR, fixture.name);
    await mkdir(dir, { recursive: true });

    for (const source of fixture.sources) {
      await writeFile(resolve(dir, `${source.id}.html`), source.html, "utf-8");
    }

    // Write manifest
    const manifest = {
      name: fixture.name,
      sources: fixture.sources.map((s) => ({
        id: s.id,
        title: s.title,
        htmlType: s.htmlType,
        wordCount: s.wordCount,
        file: `${s.id}.html`,
      })),
      totalWordCount: fixture.sources.reduce((sum, s) => sum + s.wordCount, 0),
    };
    await writeFile(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    console.log(
      `${fixture.name}: ${fixture.sources.length} sources, ${manifest.totalWordCount.toLocaleString()} words`,
    );
  }

  // Write queries
  await writeFile(resolve(FIXTURES_DIR, "queries.json"), JSON.stringify(queries, null, 2), "utf-8");
  console.log(`\nGenerated ${queries.length} evaluation queries`);

  // Summary
  const totalSources = fixtures.reduce((sum, f) => sum + f.sources.length, 0);
  const totalWords = fixtures.reduce(
    (sum, f) => sum + f.sources.reduce((s, src) => s + src.wordCount, 0),
    0,
  );
  console.log(`\nTotal: ${totalSources} sources, ${totalWords.toLocaleString()} words`);
}

main().catch((err) => {
  console.error("Failed to generate fixtures:", err);
  process.exit(1);
});
