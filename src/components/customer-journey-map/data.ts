/* Types + demo data for the Customer Journey Map. */

export type StageTone = "peach" | "butter" | "mint" | "sky" | "lilac";
export type TouchKind = "search" | "social" | "review" | "web" | "chat" | "phone" | "email" | "sms" | "visit";

export interface JourneyStage { id: string; label: string; tone?: StageTone }
export interface Touchpoint { label: string; kind: TouchKind }
export interface StageEntry {
  goal: string;
  touchpoints: Touchpoint[];
  pains: string[];
  /** −2 (very unhappy) … 2 (very happy). */
  emotion: number;
  mood: string;
  opportunity: string;
  metric: { value: string; label: string };
  quote: string;
}
export interface Persona { id: string; name: string; role: string; summary: string; color?: string; stages: Record<string, StageEntry> }
export interface JourneyData { eyebrow?: string; title?: string; subtitle?: string; stages: JourneyStage[]; personas: Persona[] }

export interface StageSelectDetail { stage: string | null; label: string | null; index: number; persona: string; emotion: number | null; mood: string | null }

export const demoData: JourneyData = {
  eyebrow: "Customer journey",
  title: "New patient journey · Brightside Dental",
  subtitle: "From first search to telling a friend",
  stages: [
    { id: "awareness", label: "Awareness", tone: "peach" },
    { id: "consideration", label: "Consideration", tone: "butter" },
    { id: "decision", label: "Decision", tone: "mint" },
    { id: "onboarding", label: "First visit", tone: "sky" },
    { id: "advocacy", label: "Advocacy", tone: "lilac" },
  ],
  personas: [
    {
      id: "sam", name: "Sam Ortiz", role: "Price-conscious first-timer",
      summary: "Hasn't seen a dentist in four years and wants clear prices before booking.",
      stages: {
        awareness: { goal: "Find a dentist nearby that takes new patients", touchpoints: [{ label: "Search ad", kind: "search" }, { label: "Review sites", kind: "review" }, { label: "Friend's text", kind: "sms" }], pains: ["Prices are hard to find", "Every site looks the same"], emotion: 0, mood: "Curious", opportunity: "Put \"New patient exam from $89\" in ads and on the map listing, so the price question is answered before the first click.", metric: { value: "3.1%", label: "Search ad click-through rate" }, quote: "I just want to know what a check-up costs before I call." },
        consideration: { goal: "Compare prices and what's included", touchpoints: [{ label: "Pricing page", kind: "web" }, { label: "Reviews", kind: "review" }, { label: "Live chat", kind: "chat" }], pains: ["Insurance info is buried", "No price for X-rays"], emotion: -1, mood: "Unsure", opportunity: "Add a plain price table that lists what each visit includes, with a \"no surprise bills\" promise.", metric: { value: "41%", label: "Exit rate on the pricing page" }, quote: "Is the X-ray extra? I honestly can't tell." },
        decision: { goal: "Book a first appointment that fits the budget", touchpoints: [{ label: "Booking form", kind: "web" }, { label: "Phone call", kind: "phone" }], pains: ["Deposit needed to book", "Total price not shown"], emotion: -2, mood: "Hesitant", opportunity: "Drop the deposit for first visits and show the full price on the booking screen.", metric: { value: "24%", label: "Booking form conversion" }, quote: "Why do they need a deposit before I've even been in?" },
        onboarding: { goal: "Get through the first visit with no surprises", touchpoints: [{ label: "Reminder text", kind: "sms" }, { label: "Front desk", kind: "visit" }, { label: "Intake form", kind: "web" }], pains: ["Long intake form on arrival"], emotion: 1, mood: "Relieved", opportunity: "Send the intake form with the reminder text so it's done before the patient arrives.", metric: { value: "92%", label: "Show rate after a reminder text" }, quote: "The bill was exactly what they said it would be. What a relief." },
        advocacy: { goal: "Feel confident coming back", touchpoints: [{ label: "Follow-up email", kind: "email" }, { label: "Review request", kind: "review" }], pains: ["Review link asked for a login"], emotion: 2, mood: "Loyal", opportunity: "Send a one-tap review link and book the six-month check-up in the same email.", metric: { value: "38%", label: "Leave a review when asked" }, quote: "I've already told my brother to go there." },
      },
    },
    {
      id: "rina", name: "Rina Patel", role: "Busy parent of three",
      summary: "Books for the whole family and needs evening slots and quick answers.",
      stages: {
        awareness: { goal: "Find a family dentist with evening hours", touchpoints: [{ label: "Parents' group", kind: "social" }, { label: "Search ad", kind: "search" }], pains: ["Opening hours missing from ads", "Unclear if they see children"], emotion: 1, mood: "Hopeful", opportunity: "Lead social posts with \"Open until 8 pm · kids welcome\".", metric: { value: "26%", label: "New patients from referrals" }, quote: "A friend said they do evenings. That's all I needed to hear." },
        consideration: { goal: "Check they can see the whole family", touchpoints: [{ label: "Website", kind: "web" }, { label: "Live chat", kind: "chat" }], pains: ["Chat replies took hours", "No family booking option"], emotion: 0, mood: "Busy", opportunity: "Answer chats within five minutes at school-run times, or offer a callback slot.", metric: { value: "4h 10m", label: "Median live chat reply time" }, quote: "I asked in the chat at lunch and got an answer at 9 pm." },
        decision: { goal: "Book all three kids in one go", touchpoints: [{ label: "Online booking", kind: "web" }, { label: "Confirmation email", kind: "email" }], pains: ["Re-typed details for each child"], emotion: 1, mood: "Pleased", opportunity: "Let parents add family members once and book them together.", metric: { value: "3.2", label: "Patients per family booking" }, quote: "Back-to-back slots for all three. Done in five minutes." },
        onboarding: { goal: "Get in and out on a school night", touchpoints: [{ label: "Waiting room", kind: "visit" }, { label: "Reminder text", kind: "sms" }], pains: ["40-minute wait with the kids", "No update while waiting"], emotion: -2, mood: "Frustrated", opportunity: "Text a heads-up with the new time when the dentist is running late.", metric: { value: "18 min", label: "Average wait past booked time" }, quote: "Forty minutes in a waiting room with three kids. Never again on a Tuesday." },
        advocacy: { goal: "Decide whether to stay", touchpoints: [{ label: "Survey email", kind: "email" }, { label: "Reschedule link", kind: "web" }], pains: ["The survey didn't ask about the wait"], emotion: 0, mood: "On the fence", opportunity: "Follow a long wait with an apology and a priority slot next time.", metric: { value: "7.1", label: "Satisfaction score out of 10" }, quote: "The care was great. The wait was not." },
      },
    },
    {
      id: "theo", name: "Theo Lind", role: "Nervous patient",
      summary: "Had a painful visit as a teenager and looks for reassurance at every step.",
      stages: {
        awareness: { goal: "Find a dentist who is gentle with nervous patients", touchpoints: [{ label: "Search", kind: "search" }, { label: "Review sites", kind: "review" }, { label: "Forums", kind: "social" }], pains: ["Reviews mention pain", "Photos look clinical"], emotion: -1, mood: "Nervous", opportunity: "Feature reviews from nervous patients and friendly photos of the team.", metric: { value: "6.2 min", label: "Average time on the reviews page" }, quote: "I read reviews for an hour looking for the word \"gentle\"." },
        consideration: { goal: "Learn exactly what a first visit involves", touchpoints: [{ label: "About page", kind: "web" }, { label: "Video tour", kind: "web" }, { label: "Phone call", kind: "phone" }], pains: ["No step-by-step of the first visit"], emotion: -1, mood: "Cautious", opportunity: "Add a short \"Your first visit, step by step\" page with the video tour.", metric: { value: "58%", label: "Watch the whole video tour" }, quote: "I needed to know exactly what would happen in that chair." },
        decision: { goal: "Book without explaining fears on the phone", touchpoints: [{ label: "Booking form", kind: "web" }, { label: "Phone call", kind: "phone" }], pains: ["Had to call to ask about sedation", "No way to flag anxiety when booking"], emotion: -2, mood: "Anxious", opportunity: "Add an optional \"I feel nervous about dental visits\" checkbox to the booking form.", metric: { value: "40%", label: "Callers who book on the first call" }, quote: "I hung up twice before I let the call connect." },
        onboarding: { goal: "Feel in control during the visit", touchpoints: [{ label: "Welcome call", kind: "phone" }, { label: "Comfort menu", kind: "visit" }], pains: ["Had to repeat the anxiety at check-in"], emotion: 1, mood: "Reassured", opportunity: "Pass the anxiety flag to the dentist and agree a stop signal before starting.", metric: { value: "9.0", label: "Comfort rating out of 10" }, quote: "They agreed a stop signal before they started. It changed everything." },
        advocacy: { goal: "Keep coming back without dread", touchpoints: [{ label: "Thank-you text", kind: "sms" }, { label: "Referral card", kind: "visit" }], pains: ["Next appointment felt far away"], emotion: 2, mood: "Grateful", opportunity: "Book the next check-up before they leave, with the same dentist.", metric: { value: "81%", label: "Book the next visit before leaving" }, quote: "First time in ten years I'm not dreading the next one." },
      },
    },
  ],
};
