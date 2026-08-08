import { SteerChip } from "./steer-chip"

export default {
  title: "App/Timeline/SteerChip",
  id: "app-timeline-steer-chip",
  tags: ["autodocs"],
}

export const Steer = {
  render: () => <SteerChip mode="steer" onClick={() => undefined} />,
}

export const Queue = {
  render: () => <SteerChip mode="queue" onClick={() => undefined} />,
}
