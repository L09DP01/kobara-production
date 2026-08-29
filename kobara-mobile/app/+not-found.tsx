import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 p-4">
      <Text className="text-error text-2xl font-bold mb-4">Screen not found.</Text>
      <Link href="/" className="text-accent underline">
        <Text>Go to home screen!</Text>
      </Link>
    </View>
  );
}
