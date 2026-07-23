import { useUserNotifications } from "../../hooks/useUserNotifications";

export function NotificationListener() {
  useUserNotifications();
  return null;
}
