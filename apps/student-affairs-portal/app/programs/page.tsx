import { Shell } from "../shell";
import { registrarName } from "../registrar";
import { ProgramsView } from "./programs-view";

export default async function ProgramsPage() {
  return (
    <Shell title="Programs" username={await registrarName()}>
      <ProgramsView />
    </Shell>
  );
}
