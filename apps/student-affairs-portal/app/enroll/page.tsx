import { Shell } from "../shell";
import { registrarName } from "../registrar";
import { EnrollView } from "./enroll-view";

export default async function EnrollPage() {
  return (
    <Shell title="Enroll" username={await registrarName()}>
      <EnrollView />
    </Shell>
  );
}
