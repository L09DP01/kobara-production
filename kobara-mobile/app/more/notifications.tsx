import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Platform, Alert, ActivityIndicator } from 'react-native';
import { Bell, ArrowDownToLine, Send, ShieldAlert } from 'lucide-react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from '@/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [settings, setSettings] = useState({
    payments: true,
    withdrawals: true,
    transfers: true,
    security: true,
  });

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Register token with backend
        apiClient.post('/mobile/notifications/register', {
          expo_push_token: token,
          device_info: {
            os: Platform.OS,
            model: Device.modelName,
            osVersion: Device.osVersion
          }
        }).catch(err => console.log('Error registering push token', err));
      }
    });

    // Fetch preferences
    apiClient.get('/mobile/notifications/preferences')
      .then(res => {
        if (res.data.success && res.data.data) {
          setSettings(prev => ({ ...prev, ...res.data.data }));
        }
      })
      .catch(err => console.log('Error fetching notification prefs', err))
      .finally(() => setLoading(false));
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F97316',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission requise', 'Vous devez autoriser les notifications pour recevoir les alertes.');
        return;
      }
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        if (!projectId) {
          throw new Error('Project ID not found');
        }
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
      } catch (e) {
        token = `${e}`;
      }
    } else {
      Alert.alert('Émulateur détecté', 'Les notifications push nécessitent un appareil physique.');
    }

    return token;
  }

  const toggleSetting = async (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    
    try {
      await apiClient.patch('/mobile/notifications/preferences', newSettings);
    } catch (e) {
      // Revert if error
      setSettings(settings);
      Alert.alert('Erreur', 'Impossible de sauvegarder les préférences.');
    }
  };

  const NotificationToggle = ({ icon: Icon, title, subtitle, settingKey }: any) => (
    <View className="py-4 flex-row items-center justify-between border-b border-white/5">
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
          <Icon size={20} color="#F97316" />
        </View>
        <View className="ml-3 flex-1 pr-4">
          <Text className="text-white font-medium">{title}</Text>
          <Text className="text-slate-400 text-xs mt-1">{subtitle}</Text>
        </View>
      </View>
      <Switch 
        value={settings[settingKey as keyof typeof settings]} 
        onValueChange={() => toggleSetting(settingKey as keyof typeof settings)}
        trackColor={{ false: "#374151", true: "#F97316" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-[#0A0F1C] px-6 pt-4">
      <Text className="text-slate-400 mb-6">
        Gérez quelles alertes push vous souhaitez recevoir sur cet appareil.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F97316" className="mt-10" />
      ) : (
        <View className="bg-[#121A2F] rounded-2xl px-4 mb-10">
          <NotificationToggle 
            icon={ArrowDownToLine} 
            title="Paiements reçus" 
            subtitle="Être notifié à chaque nouveau paiement client"
            settingKey="payments" 
          />
          <NotificationToggle 
            icon={Bell} 
            title="Retraits" 
            subtitle="Alertes sur le statut de vos demandes de retrait"
            settingKey="withdrawals" 
          />
          <NotificationToggle 
            icon={Send} 
            title="Transferts" 
            subtitle="Notifications lors de transferts vers d'autres marchands"
            settingKey="transfers" 
          />
          <View className="border-b-0">
            <NotificationToggle 
              icon={ShieldAlert} 
              title="Sécurité du compte" 
              subtitle="Alertes de connexion et modifications de sécurité"
              settingKey="security" 
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
