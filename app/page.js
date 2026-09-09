import ModeSelector from "@/component/modeSelector";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";

export default function Home() {
  return (
    <ModeSelector captain={MOCK_CAPTAIN} />
  );
}
