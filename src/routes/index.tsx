import { createFileRoute } from "@tanstack/react-router";
import { IonWake } from "@/components/game/IonWake";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <IonWake />;
}
