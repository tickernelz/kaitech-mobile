let recording = false;

export function setMeetingRecording(active: boolean) {
  recording = active;
}

export function meetingRecording(): boolean {
  return recording;
}
