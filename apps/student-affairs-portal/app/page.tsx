import { Shell } from "./shell";
import { registrarName } from "./registrar";
import { StudentsView } from "./students-view";

export default async function StudentsPage() {
  return (
    <Shell title="Students" username={await registrarName()}>
      <StudentsView />
    </Shell>
  );
}
