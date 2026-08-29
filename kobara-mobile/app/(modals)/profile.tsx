import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, User, ExternalLink, LogOut, Mail, Phone, MapPin, Building2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/useAuthStore';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { data } = useDashboardSummary();

  const merchant = data?.merchant;

  const handleEditProfile = async () => {
    // Determine the web URL from env or use production domain
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://kobara.app';
    const settingsUrl = `${webUrl}/dashboard/settings`;
    
    try {
      const canOpen = await Linking.canOpenURL(settingsUrl);
      if (canOpen) {
        await Linking.openURL(settingsUrl);
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir le navigateur.");
      }
    } catch (error) {
      Alert.alert("Erreur", "Une erreur est survenue lors de l'ouverture du lien.");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Déconnexion", 
          style: "destructive", 
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const getInitials = (name: string) => {
    if (!name) return 'K';
    return name.charAt(0).toUpperCase();
  };

  const statusLabel = merchant?.status === 'active'
    ? 'Compte Actif'
    : merchant?.status || 'Statut non défini';

  let addressData = {
    address: merchant?.address || 'Non définie',
    city: '',
    state: '',
    country: '',
    zipcode: ''
  };

  if (merchant?.address && merchant.address.startsWith('{')) {
    try {
      const parsed = JSON.parse(merchant.address);
      addressData = {
        address: parsed.address || 'Non définie',
        city: parsed.city || '',
        state: parsed.state || '',
        country: parsed.country || '',
        zipcode: parsed.zipcode || ''
      };
    } catch (e) {
      // Ignorer si ce n'est pas du JSON valide
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(merchant?.business_name || '')}</Text>
          </View>
          <Text style={styles.businessName}>{merchant?.business_name || 'Marchand'}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Information Cards */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informations (Lecture seule)</Text>
          
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Building2 size={20} color="#9CA3AF" style={styles.icon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Nom de l'entreprise</Text>
                <Text style={styles.infoValue}>{merchant?.business_name || 'Non défini'}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <Mail size={20} color="#9CA3AF" style={styles.icon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Adresse Email</Text>
                <Text style={styles.infoValue}>{merchant?.email || 'Non défini'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Phone size={20} color="#9CA3AF" style={styles.icon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Téléphone</Text>
                <Text style={styles.infoValue}>{merchant?.phone || 'Non défini'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <MapPin size={20} color="#9CA3AF" style={styles.icon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Adresse</Text>
                <Text style={styles.infoValue}>{addressData.address}</Text>
              </View>
            </View>

            {addressData.city ? (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={{ width: 20, marginRight: 16 }} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Ville</Text>
                    <Text style={styles.infoValue}>{addressData.city}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {addressData.state ? (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={{ width: 20, marginRight: 16 }} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>État / Province</Text>
                    <Text style={styles.infoValue}>{addressData.state}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {addressData.country ? (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={{ width: 20, marginRight: 16 }} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Pays</Text>
                    <Text style={styles.infoValue}>{addressData.country}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {addressData.zipcode ? (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={{ width: 20, marginRight: 16 }} />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Code Postal</Text>
                    <Text style={styles.infoValue}>{addressData.zipcode}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.editWebButton} onPress={handleEditProfile}>
            <ExternalLink size={20} color="#FF7A00" />
            <Text style={styles.editWebButtonText}>Modifier sur le Web</Text>
          </TouchableOpacity>
          
          <Text style={styles.webNoticeText}>
            Pour des raisons de sécurité, la modification de vos informations s'effectue depuis le tableau de bord web.
          </Text>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Se déconnecter</Text>
          </TouchableOpacity>
          
          <Text style={styles.versionText}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B18' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: 32, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 122, 0, 0.1)', borderWidth: 1, borderColor: '#FF7A00', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#FF7A00', fontSize: 32, fontWeight: 'bold' },
  businessName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  statusBadge: { backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#22C55E', fontSize: 12, fontWeight: 'bold', textTransform: 'capitalize' },
  infoSection: { padding: 24 },
  sectionTitle: { color: '#9CA3AF', fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  card: { backgroundColor: '#101827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  icon: { marginRight: 16 },
  infoTextContainer: { flex: 1 },
  infoLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
  infoValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 52 },
  actionsSection: { paddingHorizontal: 24, paddingBottom: 40 },
  editWebButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 122, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 122, 0, 0.3)', padding: 16, borderRadius: 12, marginBottom: 12 },
  editWebButtonText: { color: '#FF7A00', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  webNoticeText: { color: '#6B7280', fontSize: 12, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', padding: 16, borderRadius: 12, marginBottom: 24 },
  logoutButtonText: { color: '#EF4444', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  versionText: { color: '#4B5563', fontSize: 12, textAlign: 'center' }
});
