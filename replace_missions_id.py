import os

file_path = "app/manager/missions/[id]/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# 1. Update imports for simple ui
for i, line in enumerate(lines[:30]):
    if "import { Modal, ModalFooter" in line:
        lines[i] = line.replace('useToast }', 'useToast, Tabs }')

# 2. Add lucide icons
for i, line in enumerate(lines[:50]):
    if '    ListChecks,' in line:
        lines.insert(i + 1, "    Activity,\n    TrendingUp,\n    BarChart3,\n")
        break

# 3. Add activeTab
for i, line in enumerate(lines):
    if "const [isSavingTeamLead, setIsSavingTeamLead] = useState(false);" in line:
        lines.insert(i + 1, '    const [activeTab, setActiveTab] = useState("general");\n')
        break

# 4. Extract blocks to restructure
plan_de_mission_start = -1
plan_de_mission_end = -1
for i, line in enumerate(lines):
    if '{/* Plan de mission — largest, top */}' in line:
        plan_de_mission_start = i
    if '{/* Stratégie & Script */}' in line:
        plan_de_mission_end = i
        break
plan_de_mission = lines[plan_de_mission_start:plan_de_mission_end]

strat_script_start = -1
strat_script_end = -1
for i, line in enumerate(lines):
    if '{/* Stratégie & Script */}' in line:
        strat_script_start = i
    if '{/* Listes de contacts */}' in line:
        strat_script_end = i
        break
strat_script = lines[strat_script_start:strat_script_end]

listes_start = -1
listes_end = -1
for i, line in enumerate(lines):
    if '{/* Listes de contacts */}' in line:
        listes_start = i
    if '{/* Email Templates */}' in line:
        listes_end = i
        break
listes_contacts = lines[listes_start:listes_end]

emails_start = -1
emails_end = -1
for i, line in enumerate(lines):
    if '{/* Email Templates */}' in line:
        emails_start = i
    if '{/* ——— RIGHT COLUMN (reference / config) ——— */}' in line:
        emails_end = i
        break
emails_templates = lines[emails_start:emails_end]

equipe_start = -1
equipe_end = -1
for i, line in enumerate(lines):
    if '{/* Équipe (unified: responsable + SDRs + BDs) */}' in line:
        equipe_start = i
    if '{/* Statuts et workflow */}' in line:
        equipe_end = i
        break
equipe = lines[equipe_start:equipe_end]

statuts_start = -1
statuts_end = -1
for i, line in enumerate(lines):
    if '{/* Statuts et workflow */}' in line:
        statuts_start = i
    if '{/* Infos mission */}' in line:
        statuts_end = i
        break
statuts = lines[statuts_start:statuts_end]

infos_start = -1
infos_end = -1
for i, line in enumerate(lines):
    if '{/* Infos mission */}' in line:
        infos_start = i
    if '            {/* Add Template Modal */}' in line:
        infos_end = i - 3  # Removing the closing divs of the grid
        break
infos = lines[infos_start:infos_end]

# 5. Build tabs structure
tabs_ui = """
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
"""

tabs_ui = tabs_ui.replace("__INFOS_MISSION__", "".join(infos))
tabs_ui = tabs_ui.replace("__STRATEGIE_SCRIPT__", "".join(strat_script))
tabs_ui = tabs_ui.replace("__EMAIL_TEMPLATES__", "".join(emails_templates))
tabs_ui = tabs_ui.replace("__PLAN_DE_MISSION__", "".join(plan_de_mission))
tabs_ui = tabs_ui.replace("__EQUIPE__", "".join(equipe))
tabs_ui = tabs_ui.replace("__STATUTS_WORKFLOW__", "".join(statuts))
tabs_ui = tabs_ui.replace("__LISTES_CONTACTS__", "".join(listes_contacts))

start_replace_idx = -1
for i, line in enumerate(lines):
    if '{/* Two columns: left = action (62%), right = config (38%) */}' in line:
        start_replace_idx = i
        break

end_replace_idx = infos_end + 3

new_lines = lines[:start_replace_idx] + [tabs_ui + "\n"] + lines[end_replace_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Replacement successful")
