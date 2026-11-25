const viewing: number[] = [];

export function viewConversation(conversation: number): () => void {
  viewing.push(conversation);
  return () => {
    const index = viewing.indexOf(conversation);
    if (index >= 0) viewing.splice(index, 1);
  };
}

export function isViewingConversation(conversation: number): boolean {
  return viewing.includes(conversation);
}
