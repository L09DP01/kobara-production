import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

export default function MoreLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0A0F1C',
        },
        headerTintColor: '#FFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <ChevronLeft size={24} color="#FFF" />
          </TouchableOpacity>
        ),
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="account-info" 
        options={{ title: 'Profil Entreprise' }} 
      />
      <Stack.Screen 
        name="account-status" 
        options={{ title: 'État du compte' }} 
      />
      <Stack.Screen 
        name="notifications" 
        options={{ title: 'Notifications' }} 
      />
      <Stack.Screen 
        name="appearance" 
        options={{ title: 'Apparence' }} 
      />
      <Stack.Screen 
        name="system-settings" 
        options={{ title: 'Paramètres système' }} 
      />
      <Stack.Screen 
        name="invite-developer" 
        options={{ title: 'Inviter un développeur' }} 
      />
      <Stack.Screen 
        name="developer-access" 
        options={{ title: 'Gérer les accès' }} 
      />
      <Stack.Screen 
        name="licenses" 
        options={{ title: 'Bibliothèques' }} 
      />
    </Stack>
  );
}
