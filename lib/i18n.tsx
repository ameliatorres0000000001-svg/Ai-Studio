"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "kh" | "en";

const dict = {
  kh: {
    // Brand
    productName: "Claude Code Studio",
    subtitle: "AI Developer Workspace",

    // Nav
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    projects: "គម្រោង",
    workspace: "តំបន់ធ្វើការ",
    preview: "មើលជាមុន",
    settings: "ការកំណត់",

    // Sidebar
    connected: "ការតភ្ជាប់",
    activeProject: "គម្រោងសកម្ម",
    repository: "ឃ្លាំងសម្ងាត់",
    branch: "សាខា",
    fileTree: "ឯកសារ",
    searchFiles: "ស្វែងរកឯកសារ...",

    // Workflow
    github: "GitHub",
    select: "ជ្រើសរើស",
    claudeCode: "Claude Code",
    edit: "កែសម្រួល",
    diff: "Diff",
    test: "សាកល្បង",
    approve: "អនុម័ត",
    push: "បញ្ជូន",

    // Dashboard
    currentProject: "គម្រោងបច្ចុប្បន្ន",
    githubStatus: "ស្ថានភាព GitHub",
    claudeStatus: "ស្ថានភាព Claude Code",
    supabaseStatus: "ស្ថានភាព Supabase",
    deployStatus: "ស្ថានភាពបង្ហោះ",
    recentActivity: "សកម្មភាពថ្មីៗ",
    noProject: "មិនមានគម្រោង",
    selectProject: "ជ្រើសរើសគម្រោង",
    selectRepo: "ជ្រើសរើសឃ្លាំងសម្ងាត់",
    selectRepoDesc: "ភ្ជាប់ GitHub របស់អ្នក ជ្រើសរើសឃ្លាំងសម្ងាត់ និងអនុញ្ញាតឲ្យ Claude Code ធ្វើការលើគម្រោង។",
    browseProjects: "មើលគម្រោង",

    // Claude
    askClaude: "សួរ Claude",
    aiAssistant: "ជំនួយការ AI (Claude Code)",
    claudeThinking: "Claude កំពុងគិត...",
    startConversation: "ចាប់ផ្តើមសន្ទនាជាមួយ Claude",
    tryExamples: "សាកល្បង៖",
    example1: "បន្ថែមប៊ូតុង Telegram",
    example2: "ពន្យល់ឯកសារមេ",
    example3: "ជួសជុល bug ចូលប្រព័ន្ធ",
    analyze: "វិភាគ",
    editProject: "កែសម្រួលគម្រោង",
    applyChanges: "អនុវត្តការផ្លាស់ប្តូរ",
    changesApplied: "ការផ្លាស់ប្តូរត្រូវបានអនុវត្ត",
    proposeChanges: "Claude ស្នើការផ្លាស់ប្តូរ",
    filesChanged: "ឯកសារបានផ្លាស់ប្តូរ",
    reviewDiff: "ពិនិត្យមើល diff នៅក្នុងផ្ទាំង Diff បន្ទាប់មកអនុម័ត ឬត្រឡប់។",
    messagePlaceholder: "ឧ. បន្ថែមប៊ូតុង Telegram និងរក្សារចនាសម្បត្តិបច្ចុប្បន្ន...",
    researchPlaceholder: "សួរអ្វីក៏បាន (ឯកសារក្នុងគម្រោងមិនត្រូវបានប្រើទេ)...",
    modeCode: "កូដ",
    modeResearch: "ស្រាវជ្រាវ",
    modelLabel: "ម៉ូដែល",
    effortLabel: "កម្រិតការគិត",
    effortLow: "ទាប",
    effortMedium: "មធ្យម",
    effortHigh: "ខ្ពស់",
    tierFree: "ឥតគិតថ្លៃ",
    tierPro: "Pro",
    tierPremium: "Premium",
    sendMessage: "ផ្ញើ",
    attachCurrentFile: "ភ្ជាប់ឯកសារបច្ចុប្បន្ន",
    noModels: "មិនទាន់មានម៉ូដែលណាត្រូវបានកំណត់នៅលើម៉ាស៊ីនបម្រើទេ។",

    // Terminal
    terminal: "ស្ថានីយ",
    terminalReady: "ស្ថានីយរួចរាល់",
    terminalDesc: "ប្រតិបត្តិពាក្យបញ្ជាដែលអនុញ្ញាតនៅក្នុងតំបន់ធ្វើការ។ លទ្ធផលនឹងបង្ហាញនៅទីនេះ។",
    run: "ប្រតិបត្តិ",
    running: "កំពុងប្រតិបត្តិ...",
    exit: "ចេញ",
    onlyAllowlisted: "មានតែពាក្យបញ្ជាដែលបានអនុញ្ញាតប៉ុណ្ណោះដែលប្រតិបត្តិក្នុងតំបន់ធ្វើការ។ គ្មាន shell chaining, sudo, rm -rf, ឬ eval។",

    // Diff
    gitDiff: "Git Diff",
    workingTreeClean: "Working tree ស្អាត",
    cleanDesc: "មិនមានការផ្លាស់ប្តូរ។ ប្រើ Claude ដើម្បីកែឯកសារ រួចពិនិត្យ diff នៅទីនេះ។",
    commitPush: "Commit & Push",
    pushing: "កំពុងបញ្ជូន...",
    rollback: "ត្រឡប់",
    rollingBack: "កំពុងត្រឡប់...",
    commitMsg: "សារ commit...",
    committed: "បាន commit និងបញ្ជូន។ Backup tag:",
    rolledBack: "បានត្រឡប់ទៅ",

    // Activity
    activityHistory: "ប្រវត្តិសកម្មភាព",
    live: "ផ្ទាល់",
    noActivity: "មិនមានសកម្មភាពនៅឡើយ",
    noActivityDesc: "សកម្មភាពដូចជា clone, កែសម្រួល, ប្រតិបត្តិពាក្យបញ្ជា និង commit នឹងត្រូវបានកត់ត្រានៅទីនេះ។",

    // Settings
    settingsConfig: "ការកំណត់ & ការកំណត់រចនាសម្បត្តិ",
    envVars: "តម្លៃបរិស្ថាន",
    integrationStatus: "ស្ថានភាពអាំងតេក្រេស៉ង",
    githubSetting: "GitHub",
    claudeSetting: "Claude Code (Anthropic API)",
    supabaseSetting: "Supabase",
    vercelSetting: "Vercel",
    railwaySetting: "Railway",
    requiredEnvVars: "តម្លៃបរិស្ថានដែលត្រូវការ",
    notConnected: "មិនបានតភ្ជាប់ — កំណត់នៅក្នុង Settings",
    connectedAs: "បានតភ្ជាប់ជា",
    setup: "ការតំឡើង",
    configure: "កំណត់រចនាសម្បត្តិ",

    // Status
    connected_: "បានតភ្ជាប់",
    notConfigured: "មិនបានកំណត់",
    ready_: "រួចរាល់",
    syncing_: "កំពុងសមកាលកម្ម",
    idle_: "ទំនេរ",
    error_: "កំហុស",

    // IDE
    fileTabs: "ផ្ទាំងឯកសារ",
    changedFiles: "ឯកសារបានផ្លាស់ប្តូរ",
    approveReject: "អនុម័ត / បដិសេធ",
    approveBtn: "អនុម័ត",
    rejectBtn: "បដិសេធ",
    taskProgress: "វឌ្ឍនភាពការងារ",
    actions: "សកម្មភាព",
    results: "លទ្ធផល",
    quickActions: "សកម្មភាពរហ័ស",
    claudeCodeStatus: "ស្ថានភាព Claude Code",

    // Bottom tabs
    logs: "កំណត់ហេតុ",
    tests: "សាកល្បង",
    deployments: "ការបង្ហោះ",

    // Command palette
    commandPalette: "ផ្ទាំងពាក្យបញ្ជា",
    searchCommands: "ស្វែងរកពាក្យបញ្ជា...",
    noResults: "មិនមានលទ្ធផល",

    // Misc
    refresh: "ផ្ទុកឡើងវិញ",
    loading: "កំពុងផ្ទុក...",
    loadingFiles: "កំពុងផ្ទុកឯកសារ...",
    loadingDiff: "កំពុងផ្ទុក diff...",
    loadingActivity: "កំពុងផ្ទុកសកម្មភាព...",
    loadingRepos: "កំពុងផ្ទុកឃ្លាំងសម្ងាត់...",
    loadRepos: "ផ្ទុកឃ្លាំងសម្ងាត់",
    noFiles: "មិនមានឯកសារ",
    noFilesDesc: "តំបន់ធ្វើការនេះហាក់ដូចជាទទេ។",
    noProjectSelected: "មិនបានជ្រើសរើសគម្រោង",
    noProjectDesc: "ជ្រើសរើសឃ្លាំងសម្ងាត់ពីផ្ទាំងគម្រោងដើម្បីចាប់ផ្តើមរុករកឯកសារ។",
    lastSynced: "បានសមកាលចុងក្រោយ",
    syncedWorkspaces: "តំបន់ធ្វើការបានសមកាល",
    private: "ឯកជន",
    public: "សាធារណៈ",
    cloning: "កំពុង clone...",
    tryAgain: "ព្យាយាមម្តងទៀត",
    error: "កំហុស",
  },

  en: {
    productName: "Claude Code Studio",
    subtitle: "AI Developer Workspace",

    dashboard: "Dashboard",
    projects: "Projects",
    workspace: "Workspace",
    preview: "Preview",
    settings: "Settings",

    connected: "Connected",
    activeProject: "Active Project",
    repository: "Repository",
    branch: "Branch",
    fileTree: "Files",
    searchFiles: "Search files...",

    github: "GitHub",
    select: "Select",
    claudeCode: "Claude Code",
    edit: "Edit",
    diff: "Diff",
    test: "Test",
    approve: "Approve",
    push: "Push",

    currentProject: "Current Project",
    githubStatus: "GitHub Status",
    claudeStatus: "Claude Code Status",
    supabaseStatus: "Supabase Status",
    deployStatus: "Deployment Status",
    recentActivity: "Recent Activity",
    noProject: "No project",
    selectProject: "Select Project",
    selectRepo: "Select Repository",
    selectRepoDesc: "Connect your GitHub, select a repository, and let Claude Code work on your project.",
    browseProjects: "Browse Projects",

    askClaude: "Ask Claude",
    aiAssistant: "AI Assistant (Claude Code)",
    claudeThinking: "Claude is thinking...",
    startConversation: "Start a conversation with Claude",
    tryExamples: "Try:",
    example1: "Add a Telegram button",
    example2: "Explain the main file",
    example3: "Fix the login bug",
    analyze: "Analyze",
    editProject: "Edit Project",
    applyChanges: "Apply Changes",
    changesApplied: "Changes applied",
    proposeChanges: "Claude proposes changes",
    filesChanged: "files changed",
    reviewDiff: "Review the diff in the Diff tab, then approve or rollback.",
    messagePlaceholder: "e.g. Add a Telegram button and keep the current design...",
    researchPlaceholder: "Ask anything (project files are not used)...",
    modeCode: "Code",
    modeResearch: "Research",
    modelLabel: "Model",
    effortLabel: "Effort",
    effortLow: "Low",
    effortMedium: "Medium",
    effortHigh: "High",
    tierFree: "Free",
    tierPro: "Pro",
    tierPremium: "Premium",
    sendMessage: "Send",
    attachCurrentFile: "Attach current file",
    noModels: "No models are configured on the server.",

    terminal: "Terminal",
    terminalReady: "Terminal ready",
    terminalDesc: "Run allowlisted commands inside the workspace. Output will appear here.",
    run: "Run",
    running: "Running...",
    exit: "Exit",
    onlyAllowlisted: "Only allowlisted commands run inside the workspace. No shell chaining, sudo, rm -rf, or eval.",

    gitDiff: "Git Diff",
    workingTreeClean: "Working tree is clean",
    cleanDesc: "No uncommitted changes. Use Claude to edit files, then check back here to review the diff.",
    commitPush: "Commit & Push",
    pushing: "Pushing...",
    rollback: "Rollback",
    rollingBack: "Rolling back...",
    commitMsg: "Commit message...",
    committed: "Committed and pushed. Backup tag:",
    rolledBack: "Rolled back to",

    activityHistory: "Activity History",
    live: "Live",
    noActivity: "No activity yet",
    noActivityDesc: "Actions like cloning, editing, running commands, and committing will be logged here.",

    settingsConfig: "Settings & Configuration",
    envVars: "Environment variables",
    integrationStatus: "Integration status",
    githubSetting: "GitHub",
    claudeSetting: "Claude Code (Anthropic API)",
    supabaseSetting: "Supabase",
    vercelSetting: "Vercel",
    railwaySetting: "Railway",
    requiredEnvVars: "Required Environment Variables",
    notConnected: "Not connected — Configure in Settings",
    connectedAs: "Connected as",
    setup: "Setup",
    configure: "Configure",

    connected_: "Connected",
    notConfigured: "Not configured",
    ready_: "Ready",
    syncing_: "Syncing",
    idle_: "Idle",
    error_: "Error",

    fileTabs: "File Tabs",
    changedFiles: "Changed Files",
    approveReject: "Approve / Reject",
    approveBtn: "Approve",
    rejectBtn: "Reject",
    taskProgress: "Task Progress",
    actions: "Actions",
    results: "Results",
    quickActions: "Quick Actions",
    claudeCodeStatus: "Claude Code Status",

    logs: "Logs",
    tests: "Tests",
    deployments: "Deployments",

    commandPalette: "Command Palette",
    searchCommands: "Search commands...",
    noResults: "No results",

    refresh: "Refresh",
    loading: "Loading...",
    loadingFiles: "Loading files...",
    loadingDiff: "Loading diff...",
    loadingActivity: "Loading activity...",
    loadingRepos: "Loading repositories...",
    loadRepos: "Load Repositories",
    noFiles: "No files found",
    noFilesDesc: "This workspace appears to be empty.",
    noProjectSelected: "No project selected",
    noProjectDesc: "Select a repository from the Projects tab to start browsing files.",
    lastSynced: "Last synced",
    syncedWorkspaces: "Synced Workspaces",
    private: "Private",
    public: "Public",
    cloning: "Cloning...",
    tryAgain: "Try Again",
    error: "Error",
  },
};

type Dict = typeof dict.en;
export type TKey = keyof Dict;

interface LangCtx {
  lang: Lang;
  t: (key: TKey) => string;
  toggle: () => void;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LangCtx>({
  lang: "kh",
  t: (key) => dict.en[key] || String(key),
  toggle: () => {},
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("kh");

  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ccs-lang") : null;
    if (saved === "en" || saved === "kh") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("ccs-lang", l);
  }

  function toggle() {
    setLang(lang === "kh" ? "en" : "kh");
  }

  const t = (key: TKey): string => dict[lang][key] || dict.en[key] || String(key);

  return (
    <LanguageContext.Provider value={{ lang, t, toggle, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
