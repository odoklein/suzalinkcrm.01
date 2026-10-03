const fs = require('fs');

const filePath = "app/manager/missions/[id]/page.tsx";
const lines = fs.readFileSync(filePath, "utf-8").split("\n");

// 1. Update imports
for (let i = 0; i < 30; i++) {
    if (lines[i].includes("import { Modal, ModalFooter")) {
        lines[i] = lines[i].replace('useToast }', 'useToast, Tabs }');
    }
}

// 2. Add lucide icons
for (let i = 0; i < 50; i++) {
    if (lines[i].includes('    ListChecks,')) {
        lines.splice(i + 1, 0, "    Activity,", "    TrendingUp,", "    BarChart3,");
        break;
    }
}

// 3. Add activeTab
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const [isSavingTeamLead, setIsSavingTeamLead] = useState(false);")) {
        lines.splice(i + 1, 0, '    const [activeTab, setActiveTab] = useState("general");');
        break;
    }
}

// Helper to find range
function findRange(startTag, endTag) {
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(startTag) && start === -1) start = i;
        if (lines[i].includes(endTag) && start !== -1) {
            end = i;
            break;
        }
    }
    return lines.slice(start, end).join("\n");
}

const planDeMission = findRange('{/* Plan de mission — largest, top */}', '{/* Stratégie & Script */}');
const stratScript = findRange('{/* Stratégie & Script */}', '{/* Listes de contacts */}');
const listesContacts = findRange('{/* Listes de contacts */}', '{/* Email Templates */}');
const emailTemplates = findRange('{/* Email Templates */}', '{/* ——— RIGHT COLUMN (reference / config) ——— */}');
const equipe = findRange('{/* Équipe (unified: responsable + SDRs + BDs) */}', '{/* Statuts et workflow */}');
const statuts = findRange('{/* Statuts et workflow */}', '{/* Infos mission */}');

let infosStart = -1, infosEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Infos mission */}')) infosStart = i;
    if (lines[i].includes('            {/* Add Template Modal */}')) {
        infosEnd = i - 3;
        break;
    }
}
const infos = lines.slice(infosStart, infosEnd).join("\n");

let tabsUi = `
            {/* TABS NAVIGATION */}
            <div className="mt-6 border-b border-slate-200">
                <Tabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabs={[
                        { id: "general", label: "Général", icon: <Activity className="w-4 h-4" /> },
                        { id: "strategy", label: "Stratégie & Scripts", icon: <Target className="w-4 h-4" /> },
                        { id: "planning", label: "Planification & Équipe", icon: <Calendar className="w-4 h-4" /> },
                        { id: "audience", label: "Audiences", icon: <Users className="w-4 h-4" /> },
                    ]}
                />
            </div>

            {/* TAB CONTENT */}
            <div className="mt-8">
                {activeTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* KPI Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <span className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +12%
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">425</h3>
                                <p className="text-sm text-slate-500 font-medium">Appels passés</p>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <Target className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <span className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +5%
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">18</h3>
                                <p className="text-sm text-slate-500 font-medium">Rendez-vous qualifiés</p>
                            </div>
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-violet-600" />
                                    </div>
                                    <span className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> +2%
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">4.2%</h3>
                                <p className="text-sm text-slate-500 font-medium">Taux de conversion</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            __INFOS_MISSION__
                        </div>
                    </div>
                )}

                {activeTab === "strategy" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
__STRATEGIE_SCRIPT__
__EMAIL_TEMPLATES__
                    </div>
                )}

                {activeTab === "planning" && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-6">
__PLAN_DE_MISSION__
                        </div>
                        <div className="space-y-6">
__EQUIPE__
__STATUTS_WORKFLOW__
                        </div>
                    </div>
                )}

                {activeTab === "audience" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
__LISTES_CONTACTS__
                    </div>
                )}
            </div>
`;

tabsUi = tabsUi.replace("__INFOS_MISSION__", infos);
tabsUi = tabsUi.replace("__STRATEGIE_SCRIPT__", stratScript);
tabsUi = tabsUi.replace("__EMAIL_TEMPLATES__", emailTemplates);
tabsUi = tabsUi.replace("__PLAN_DE_MISSION__", planDeMission);
tabsUi = tabsUi.replace("__EQUIPE__", equipe);
tabsUi = tabsUi.replace("__STATUTS_WORKFLOW__", statuts);
tabsUi = tabsUi.replace("__LISTES_CONTACTS__", listesContacts);

let startReplaceIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Two columns: left = action (62%), right = config (38%) */}')) {
        startReplaceIdx = i;
        break;
    }
}

const newLines = [
    ...lines.slice(0, startReplaceIdx),
    tabsUi,
    ...lines.slice(infosEnd + 3)
];

fs.writeFileSync(filePath, newLines.join("\n"));
console.log("Replacement successful");
