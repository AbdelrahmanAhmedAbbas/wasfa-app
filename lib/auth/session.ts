// The signed-in user's id for code that runs outside React, such as the meal plan
// stored on the device. AuthProvider keeps it current.
let currentUserId: string | null = null;

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}
