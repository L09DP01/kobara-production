import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Mail, Phone, Wallet, Smartphone, ShieldAlert } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomerDetails } from '@/hooks/useCustomers';

export default function CustomerDetailsScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const router = useRouter();
  
  const { data: customer, isLoading, isError, refetch, isRefetching } = useCustomerDetails(customerId as string);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const getInitials = (name?: string) => {
    if (!name) return 'C';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name?: string) => {
    if (!name) return 'from-slate-500 to-slate-600';
    const colors = [
      'from-orange-400 to-orange-600',
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-indigo-400 to-indigo-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF7A00" />
        </View>
      );
    }

    if (isError || !customer) {
      return (
        <View style={styles.centerContainer}>
          <ShieldAlert size={48} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Erreur lors du chargement des informations.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#FF7A00" />}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: '#1F2937' }]}>
              <Text style={styles.avatarText}>{getInitials(customer.name)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{customer.name}</Text>
              <Text style={styles.since}>Client depuis le {new Date(customer.createdAt).toLocaleDateString('fr-FR')}</Text>
            </View>
          </View>

          <View style={styles.contactInfo}>
            <View style={styles.contactRow}>
              <Mail size={16} color="#9CA3AF" />
              <Text style={styles.contactText}>{customer.email || 'Non renseigné'}</Text>
            </View>
            <View style={styles.contactRow}>
              <Phone size={16} color="#9CA3AF" />
              <Text style={styles.contactText}>{customer.phone || 'Non renseigné'}</Text>
            </View>
            {customer.wallet && (
              <View style={styles.contactRow}>
                <Wallet size={16} color="#9CA3AF" />
                <Text style={styles.contactText}>{customer.wallet}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Volume Total Net</Text>
            <Text style={styles.statValue}>{customer.stats.totalSpent.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Frais</Text>
            <Text style={[styles.statValue, { color: '#9CA3AF' }]}>{customer.stats.totalFees.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG</Text>
          </View>

          <View style={[styles.statRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={styles.statLabel}>Paiements Réussis</Text>
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>{customer.stats.transactionCount} / {customer.stats.totalTransactions}</Text>
            </View>
          </View>
        </View>

        {/* Transactions */}
        <Text style={[styles.sectionTitle, { marginLeft: 8, marginTop: 16 }]}>Historique des transactions ({customer.payments.length})</Text>
        
        {customer.payments.length === 0 ? (
          <View style={styles.emptyTransactions}>
            <Text style={styles.emptyTransactionsText}>Aucune transaction pour ce client.</Text>
          </View>
        ) : (
          customer.payments.map((payment, index) => (
            <View key={payment.id || index} style={styles.transactionCard}>
              <View style={styles.txHeader}>
                <Text style={styles.txRef}>{payment.kobara_reference || 'REF INCONNUE'}</Text>
                <Text style={styles.txDate}>
                  {new Date(payment.created_at).toLocaleDateString('fr-FR')} {new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute:'2-digit' })}
                </Text>
              </View>
              
              <View style={styles.txBody}>
                <View style={styles.txMethod}>
                  <View style={styles.txMethodIcon}>
                    <Smartphone size={14} color="#F97316" />
                  </View>
                  <Text style={styles.txMethodText}>{payment.provider || 'Inconnu'}</Text>
                </View>

                <View style={styles.txAmountContainer}>
                  <Text style={styles.txAmount}>
                    {Number(payment.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {payment.currency || 'HTG'}
                  </Text>
                  
                  {payment.status === 'succeeded' || payment.status === 'completed' ? (
                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                      <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
                      <Text style={[styles.statusText, { color: '#4ADE80' }]}>Succès</Text>
                    </View>
                  ) : payment.status === 'failed' ? (
                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                      <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.statusText, { color: '#F87171' }]}>Échoué</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: 'rgba(249, 115, 22, 0.3)' }]}>
                      <View style={[styles.statusDot, { backgroundColor: '#F97316' }]} />
                      <Text style={[styles.statusText, { color: '#FB923C' }]}>En attente</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du client</Text>
        <View style={styles.placeholder} />
      </View>

      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B18',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  since: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  contactInfo: {
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  statValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeSuccessText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyTransactions: {
    padding: 24,
    backgroundColor: '#101827',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTransactionsText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  transactionCard: {
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  txRef: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  txDate: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  txBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txMethodIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txMethodText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
