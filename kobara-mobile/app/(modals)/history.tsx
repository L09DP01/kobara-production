import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

export default function HistoryScreen() {
  const router = useRouter();
  
  return (
    <View className="flex-1 bg-[#050B18]">
      <View className="pt-14 pb-4 px-4 flex-row items-center border-b border-white/5">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Activité complète</Text>
      </View>
      <View className="flex-1 items-center justify-center">
        <Text className="text-[#9CA3AF]">Historique complet (Bientôt disponible)</Text>
      </View>
    </View>
  );
}
