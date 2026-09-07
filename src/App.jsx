import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  Sparkles,
  UtensilsCrossed,
  Wine,
  ChefHat,
  Compass,
  Plane,
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  User,
  ClipboardList,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

const AREAS = [
  {
    id: "front-office",
    label: "Front Office",
    icon: Bell,
    blurb: "Check-ins, reservations and the desk.",
    scenarios: [
      "Guest check-in",
      "Reservation",
      "Telephone enquiry",
      "Complaint handling",
      "Group check-in",
      "Walk-in guest",
      "Check-out",
      "Payment problem",
      "Overbooking",
      "VIP arrival",
      "Difficult guest",
    ],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    icon: Sparkles,
    blurb: "Rooms, requests and the unexpected.",
    scenarios: [
      "Room inspection",
      "Request for extra amenities",
      "Damaged item report",
      "Lost property",
      "Late checkout coordination",
      "Do-not-disturb conflict",
    ],
  },
  {
    id: "restaurant-service",
    label: "Restaurant Service",
    icon: UtensilsCrossed,
    blurb: "Tables, orders and the floor.",
    scenarios: [
      "Taking an order",
      "Wrong order complaint",
      "Table reservation",
      "Dietary requirement request",
      "Menu recommendation",
      "Large group service",
    ],
  },
  {
    id: "bar-operations",
    label: "Bar Operations",
    icon: Wine,
    blurb: "The bar, the tab and the crowd.",
    scenarios: [
      "Drink recommendation",
      "Handling an intoxicated guest",
      "Age verification",
      "Bar tab dispute",
      "Happy hour enquiry",
    ],
  },
  {
    id: "culinary",
    label: "Culinary",
    icon: ChefHat,
    blurb: "The kitchen meets the floor.",
    scenarios: [
      "Special dietary request",
      "Ingredient substitution query",
      "Food safety complaint",
      "Explaining a dish to a guest",
      "Kitchen delay communication",
    ],
  },
  {
    id: "tour-guiding",
    label: "Tour Guiding",
    icon: Compass,
    blurb: "The group, the route and the story.",
    scenarios: [
      "Welcome briefing",
      "Itinerary change request",
      "Guest safety concern",
      "Cultural question",
      "Lost member of the group",
      "Wildlife encounter guidance",
    ],
  },
  {
    id: "travel-agency",
    label: "Travel Agency",
    icon: Plane,
    blurb: "Bookings, budgets and plans.",
    scenarios: [
      "Booking enquiry",
      "Itinerary customisation",
      "Visa or documentation question",
      "Cancellation and refund request",
      "Budget travel planning",
      "Complaint about a booked package",
    ],
  },
];

const LEVELS = [
  { id: 1, label: "Level 1", tag: "Basic", desc: "A simple, low-pressure request." },
  { id: 2, label: "Level 2", tag: "Intermediate", desc: "A logistical problem needs solving." },
  { id: 3, label: "Level 3", tag: "Difficult", desc: "Something has gone wrong and the guest is unhappy." },
  { id: 4, label: "Level 4", tag: "Advanced", desc: "A tense, high-pressure situation with an upset guest." },
];

const PERSONALITIES = [
  { id: "friendly", label: "Friendly guest", emoji: "🙂" },
  { id: "impatient", label: "Impatient guest", emoji: "😐" },
  { id: "angry", label: "Angry guest", emoji: "😠" },
  { id: "confused", label: "Confused guest", emoji: "🤔" },
  { id: "business", label: "Business traveller", emoji: "💼" },
  { id: "family", label: "Family traveller", emoji: "👨‍👩‍👧" },
  { id: "international", label: "International tourist", emoji: "🌍" },
  { id: "accessibility", label: "Guest requiring accessibility assistance", emoji: "♿" },
];

const COMPETENCY_LABELS = {
  greeting: "Greeting",
  communication: "Communication",
  professionalism: "Professionalism",
  empathy: "Empathy",
  problemSolving: "Problem solving",
  productKnowledge: "Product knowledge",
  complaintHandling: "Complaint handling",
  closingInteraction: "Closing interaction",
};

const STEPS = ["Name", "Area", "Scenario", "Level", "Guest"];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function callClaude(system, messages) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  if (!response.ok) throw new Error("Request failed: " + response.status);
  const data = await response.json();
  const text = (data.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
  return text;
}

function guestSystemPrompt({ area, scenario, level, personality }) {
  return `You are role-playing as a guest inside ZimTour Skills AI, a practical training simulator used by tourism and hospitality students in Zimbabwe.

Department the student is working in: ${area.label}
Scenario: ${scenario}
Your persona: ${personality.label}
Difficulty: ${level.label} (${level.tag}) — ${level.desc}

Rules you must follow at all times:
- Stay fully in character as the guest. Never break character, never mention you are an AI, never offer meta-commentary.
- Speak the way a real guest would: natural, spoken register, normally 1-4 sentences.
- The student is playing the staff member. You never act as staff and never solve the problem yourself.
- Open the very first message by initiating the scenario naturally, as the guest would.
- Weave in a complication appropriate to the difficulty level as the conversation develops: level 1 stays easy and pleasant; level 2 introduces a logistical snag; level 3 involves something going wrong that genuinely annoys you; level 4 is tense, with real frustration, escalating if the student handles it poorly and only easing if they genuinely address your concern.
- React credibly to what the student says — soften when they do well, stay firm or escalate (within the bounds of your persona) when they don't.
- Keep the scenario grounded in a real Zimbabwean tourism and hospitality setting.`;
}

function assessmentSystemPrompt({ area, scenario, level, personality }) {
  return `You are the assessment engine for ZimTour Skills AI, a hospitality training simulator. You will receive a full transcript of a role-play between a student (staff member in the ${area.label} department, scenario: "${scenario}") and an AI-played guest ("${personality.label}", difficulty ${level.label} — ${level.tag}).

Score the student's performance strictly on evidence from the transcript. Be fair, specific and constructive.

Respond with ONLY valid JSON — no markdown fences, no preamble, no trailing text — in exactly this shape:
{
  "scores": {
    "greeting": number,
    "communication": number,
    "professionalism": number,
    "empathy": number,
    "problemSolving": number,
    "productKnowledge": number,
    "complaintHandling": number,
    "closingInteraction": number,
    "overall": number
  },
  "strengths": [string, string, string],
  "improvements": [string, string],
  "recommendedPractice": string
}
All scores are percentages from 0-100. "overall" should reasonably reflect the other scores. Keep each string under 20 words. "recommendedPractice" should name a concrete next simulation to repeat (department, scenario and level).`;
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// UI atoms
// ---------------------------------------------------------------------------

function Rail({ step }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold border ${
                i < step
                  ? "bg-[#B98B3E] border-[#B98B3E] text-[#16241D]"
                  : i === step
                  ? "border-[#B98B3E] text-[#B98B3E]"
                  : "border-[#4B5B52] text-[#7C8B81]"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-[13px] hidden sm:inline ${
                i <= step ? "text-[#F7F2E7]" : "text-[#7C8B81]"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 ${i < step ? "bg-[#B98B3E]" : "bg-[#3A473F]"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = "Continue", nextDisabled }) {
  return (
    <div className="flex items-center justify-between mt-10">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#C9BFA6] hover:text-[#F7F2E7] transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center gap-2 rounded-full bg-[#B98B3E] text-[#16241D] font-semibold text-sm px-6 py-2.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#CC9D4B] transition-colors"
      >
        {nextLabel} <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function App() {
  const [screen, setScreen] = useState("setup"); // setup | chat | report
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [levelId, setLevelId] = useState(null);
  const [personalityId, setPersonalityId] = useState(null);

  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', content}
  const [draft, setDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(null);

  const [report, setReport] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState(null);

  const scrollRef = useRef(null);

  const area = AREAS.find((a) => a.id === areaId);
  const level = LEVELS.find((l) => l.id === levelId);
  const personality = PERSONALITIES.find((p) => p.id === personalityId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, chatBusy]);

  function resetAll() {
    setScreen("setup");
    setStep(0);
    setName("");
    setAreaId(null);
    setScenario(null);
    setLevelId(null);
    setPersonalityId(null);
    setMessages([]);
    setDraft("");
    setChatError(null);
    setReport(null);
    setReportError(null);
  }

  async function beginSimulation() {
    setScreen("chat");
    setChatBusy(true);
    setChatError(null);
    try {
      const sys = guestSystemPrompt({ area, scenario, level, personality });
      const opener = await callClaude(sys, [
        { role: "user", content: "[Simulation start. Open the scenario now, in character, as the guest.]" },
      ]);
      setMessages([{ role: "assistant", content: opener }]);
    } catch (e) {
      setChatError("The guest couldn't be reached. Check the connection and try again.");
    } finally {
      setChatBusy(false);
    }
  }

  async function sendReply() {
    const text = draft.trim();
    if (!text || chatBusy) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");
    setChatBusy(true);
    setChatError(null);
    try {
      const sys = guestSystemPrompt({ area, scenario, level, personality });
      const reply = await callClaude(sys, nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (e) {
      setChatError("The guest's reply didn't come through. You can try sending again.");
    } finally {
      setChatBusy(false);
    }
  }

  async function endSimulation() {
    setScreen("report");
    setReportBusy(true);
    setReportError(null);
    try {
      const transcript = messages
        .map((m) => `${m.role === "assistant" ? "Guest" : "Student"}: ${m.content}`)
        .join("\n");
      const sys = assessmentSystemPrompt({ area, scenario, level, personality });
      const raw = await callClaude(sys, [{ role: "user", content: transcript }]);
      const parsed = parseJsonLoose(raw);
      setReport(parsed);
    } catch (e) {
      setReportError("The assessment couldn't be generated. You can try again.");
    } finally {
      setReportBusy(false);
    }
  }

  async function retryReport() {
    setReportError(null);
    setReportBusy(true);
    try {
      const transcript = messages
        .map((m) => `${m.role === "assistant" ? "Guest" : "Student"}: ${m.content}`)
        .join("\n");
      const sys = assessmentSystemPrompt({ area, scenario, level, personality });
      const raw = await callClaude(sys, [{ role: "user", content: transcript }]);
      const parsed = parseJsonLoose(raw);
      setReport(parsed);
    } catch (e) {
      setReportError("Still couldn't generate the assessment. Please try again shortly.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#16241D] text-[#F7F2E7]" style={{ fontFamily: "'Work Sans', ui-sans-serif, system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');
        .disp { font-family: 'Fraunces', ui-serif, Georgia, serif; }
      `}</style>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[11px] tracking-wide text-[#B98B3E]">ZimTour Skills AI</div>
            <div className="disp text-2xl leading-tight">Tourism &amp; Hospitality Lab</div>
          </div>
          {screen !== "setup" && (
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 text-xs text-[#C9BFA6] hover:text-[#F7F2E7] border border-[#3A473F] rounded-full px-3 py-1.5 transition-colors"
            >
              <RotateCcw size={13} /> Start over
            </button>
          )}
        </header>

        {screen === "setup" && (
          <div>
            <Rail step={step} />

            {step === 0 && (
              <div>
                <h2 className="disp text-xl mb-1">Who's practising today?</h2>
                <p className="text-sm text-[#B7ADA0] mb-6">Your name appears on your performance report.</p>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daisy Moyo"
                  className="w-full bg-transparent border-b border-[#4B5B52] focus:border-[#B98B3E] outline-none text-lg py-2 placeholder:text-[#5C6B62] transition-colors"
                />
                <NavButtons onNext={() => setStep(1)} nextDisabled={name.trim().length === 0} />
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="disp text-xl mb-1">Select your practical area</h2>
                <p className="text-sm text-[#B7ADA0] mb-6">This sets the department you'll be working in.</p>
                <div className="grid grid-cols-2 gap-3">
                  {AREAS.map((a) => {
                    const Icon = a.icon;
                    const active = a.id === areaId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setAreaId(a.id)}
                        className={`text-left rounded-xl border p-4 transition-colors ${
                          active
                            ? "border-[#B98B3E] bg-[#1D2F25]"
                            : "border-[#3A473F] hover:border-[#5C6B62]"
                        }`}
                      >
                        <Icon size={18} className="mb-2 text-[#B98B3E]" />
                        <div className="text-sm font-medium">{a.label}</div>
                        <div className="text-xs text-[#8A9A8F] mt-0.5">{a.blurb}</div>
                      </button>
                    );
                  })}
                </div>
                <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!areaId} />
              </div>
            )}

            {step === 2 && area && (
              <div>
                <h2 className="disp text-xl mb-1">Choose a scenario</h2>
                <p className="text-sm text-[#B7ADA0] mb-6">{area.label} — pick what you'll handle.</p>
                <div className="flex flex-col gap-2">
                  {area.scenarios.map((s) => (
                    <button
                      key={s}
                      onClick={() => setScenario(s)}
                      className={`text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                        scenario === s
                          ? "border-[#B98B3E] bg-[#1D2F25]"
                          : "border-[#3A473F] hover:border-[#5C6B62]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!scenario} />
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="disp text-xl mb-1">Set the difficulty</h2>
                <p className="text-sm text-[#B7ADA0] mb-6">Harder levels bring bigger complications.</p>
                <div className="flex flex-col gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLevelId(l.id)}
                      className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                        levelId === l.id
                          ? "border-[#B98B3E] bg-[#1D2F25]"
                          : "border-[#3A473F] hover:border-[#5C6B62]"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{l.label}</span>
                        <span className="text-[#B98B3E] text-xs">— {l.tag}</span>
                      </div>
                      <div className="text-xs text-[#8A9A8F] mt-0.5">{l.desc}</div>
                    </button>
                  ))}
                </div>
                <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!levelId} />
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="disp text-xl mb-1">Who's the guest?</h2>
                <p className="text-sm text-[#B7ADA0] mb-6">Choose the personality the AI will play.</p>
                <div className="grid grid-cols-2 gap-2">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPersonalityId(p.id)}
                      className={`text-left rounded-lg border px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                        personalityId === p.id
                          ? "border-[#B98B3E] bg-[#1D2F25]"
                          : "border-[#3A473F] hover:border-[#5C6B62]"
                      }`}
                    >
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-8 rounded-xl border border-[#3A473F] p-4 bg-[#1A2B22]">
                  <div className="text-[11px] tracking-wide text-[#8A9A8F] mb-2">Simulation summary</div>
                  <div className="text-sm space-y-1 text-[#D9D1C1]">
                    <div><span className="text-[#8A9A8F]">Student:</span> {name || "—"}</div>
                    <div><span className="text-[#8A9A8F]">Area:</span> {area ? area.label : "—"}</div>
                    <div><span className="text-[#8A9A8F]">Scenario:</span> {scenario || "—"}</div>
                    <div><span className="text-[#8A9A8F]">Level:</span> {level ? `${level.label} — ${level.tag}` : "—"}</div>
                    <div><span className="text-[#8A9A8F]">Guest:</span> {personality ? personality.label : "—"}</div>
                  </div>
                </div>

                <NavButtons
                  onBack={() => setStep(3)}
                  onNext={beginSimulation}
                  nextLabel="Start simulation"
                  nextDisabled={!personalityId}
                />
              </div>
            )}
          </div>
        )}

        {screen === "chat" && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="text-xs text-[#8A9A8F]">{area.label} · {scenario}</div>
                <div className="text-sm text-[#B98B3E]">
                  {level.label} — {level.tag} · {personality.emoji} {personality.label}
                </div>
              </div>
              <button
                onClick={endSimulation}
                disabled={messages.length === 0 || chatBusy}
                className="flex items-center gap-1.5 rounded-full bg-[#B98B3E] text-[#16241D] font-semibold text-xs px-4 py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#CC9D4B] transition-colors"
              >
                <ClipboardList size={14} /> End simulation &amp; get report
              </button>
            </div>

            <div
              ref={scrollRef}
              className="h-[420px] overflow-y-auto rounded-xl border border-[#3A473F] bg-[#1A2B22] p-4 flex flex-col gap-3"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#B98B3E] text-[#16241D] rounded-br-sm"
                        : "bg-[#243B2E] text-[#F0EBDD] rounded-bl-sm"
                    }`}
                  >
                    {m.role !== "user" && (
                      <div className="text-[10px] uppercase tracking-wide text-[#8A9A8F] mb-1">Guest</div>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              {chatBusy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-2.5 bg-[#243B2E] text-[#8A9A8F] text-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Guest is typing…
                  </div>
                </div>
              )}
              {chatError && (
                <div className="text-xs text-[#E0A0A0] flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {chatError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder="Respond as the staff member…"
                disabled={chatBusy}
                className="flex-1 bg-[#1A2B22] border border-[#3A473F] focus:border-[#B98B3E] outline-none rounded-full px-4 py-2.5 text-sm placeholder:text-[#5C6B62] transition-colors"
              />
              <button
                onClick={sendReply}
                disabled={chatBusy || !draft.trim()}
                className="h-10 w-10 shrink-0 rounded-full bg-[#B98B3E] text-[#16241D] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#CC9D4B] transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {screen === "report" && (
          <div>
            <h2 className="disp text-2xl mb-1">Student performance report</h2>
            <p className="text-sm text-[#B7ADA0] mb-6">
              {name} · {area.label} · {scenario} · {level.label}
            </p>

            {reportBusy && (
              <div className="flex items-center gap-2 text-sm text-[#8A9A8F] py-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Scoring the conversation…
              </div>
            )}

            {reportError && !reportBusy && (
              <div className="rounded-xl border border-[#5C3A3A] bg-[#2A1E1E] p-5 text-sm text-[#E0A0A0] flex flex-col gap-3">
                <div className="flex items-center gap-2"><AlertTriangle size={15} /> {reportError}</div>
                <button
                  onClick={retryReport}
                  className="self-start rounded-full bg-[#B98B3E] text-[#16241D] text-xs font-semibold px-4 py-2"
                >
                  Try again
                </button>
              </div>
            )}

            {report && !reportBusy && (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-[#3A473F] overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(COMPETENCY_LABELS).map(([key, label]) => (
                        <tr key={key} className="border-b border-[#3A473F] last:border-0">
                          <td className="px-4 py-2.5 text-[#D9D1C1]">{label}</td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {report.scores && report.scores[key] != null ? `${report.scores[key]}%` : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#1D2F25]">
                        <td className="px-4 py-3 font-semibold disp text-base">Overall</td>
                        <td className="px-4 py-3 text-right font-semibold disp text-base text-[#B98B3E]">
                          {report.scores && report.scores.overall != null ? `${report.scores.overall}%` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-[#3A473F] p-5">
                  <div className="disp text-lg mb-3">AI feedback</div>

                  <div className="text-xs uppercase tracking-wide text-[#8A9A8F] mb-2">Strengths</div>
                  <ul className="flex flex-col gap-1.5 mb-4">
                    {(report.strengths || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#D9D1C1]">
                        <CheckCircle2 size={15} className="text-[#7FAE8B] mt-0.5 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>

                  <div className="text-xs uppercase tracking-wide text-[#8A9A8F] mb-2">Needs improvement</div>
                  <ul className="flex flex-col gap-1.5 mb-4">
                    {(report.improvements || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#D9D1C1]">
                        <AlertTriangle size={15} className="text-[#D9B36C] mt-0.5 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>

                  <div className="text-xs uppercase tracking-wide text-[#8A9A8F] mb-2">Recommended practice</div>
                  <p className="text-sm text-[#D9D1C1] border-l-2 border-[#B98B3E] pl-3">
                    {report.recommendedPractice}
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={resetAll}
                    className="flex items-center gap-1.5 rounded-full bg-[#B98B3E] text-[#16241D] font-semibold text-sm px-5 py-2.5 hover:bg-[#CC9D4B] transition-colors"
                  >
                    <RotateCcw size={15} /> Run another simulation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
