import { useStory } from "@/context/StoryContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function IndexRedirect() {
  const { settings, messages } = useStory();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!settings) {
        router.replace("/setup");
      } else if (messages.length === 0) {
        router.replace("/story");
      } else {
        router.replace("/story");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [settings, messages]);

  return <View style={{ flex: 1, backgroundColor: "#08080F" }} />;
}
