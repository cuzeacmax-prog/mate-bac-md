import FigureLivePlayground from "./FigureLivePlayground";

export const metadata = { title: "Figură live" };

export default function FiguraLivePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Chat enunț → figură (live)</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        Scrie o condiție; AI-ul clasifică (2D / 3D / fără figură), generează specul prin constrângeri și
        randează imediat. <strong>Onest</strong>: dacă e 3D fără șablon (avem doar piramida regulată), o spune;
        dacă nu e figură, o spune. Fără persistare.
      </p>
      <div className="mt-6">
        <FigureLivePlayground />
      </div>
    </div>
  );
}
