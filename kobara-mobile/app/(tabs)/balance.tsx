import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Scan, Bell, Eye, EyeOff, Send, Download, ChevronRight, ArrowUpRight, ArrowDown } from 'lucide-react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { useBalance } from '@/hooks/useBalance';
import { QRBottomSheet } from '@/components/balance/QRBottomSheet';
import { MyQRSheet } from '@/components/balance/MyQRSheet';
import { MobileActivityItem } from '@/services/balance';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export default function BalanceScreen() {
  const router = useRouter();
  const { user, merchant } = useAuthStore();
  const [showBalance, setShowBalance] = useState(true);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isMyQrSheetVisible, setIsMyQrSheetVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<MobileActivityItem | null>(null);
  
  const { data: balanceData, isLoading: isLoadingBalance, refetch: refetchBalance, isRefetching } = useBalance();
  const { data: dashboardData } = useDashboardSummary();

  const onRefresh = useCallback(() => {
    refetchBalance();
  }, [refetchBalance]);

  const toggleBalance = useCallback(() => {
    setShowBalance(prev => !prev);
  }, []);

  const formatAmount = useCallback((amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  }, []);

  const renderActivityItem = useCallback(({ item }: { item: MobileActivityItem }) => {
    const isPositive = item.amount_type === 'positive';
    const amountColor = isPositive ? '#22C55E' : '#EF4444';
    const amountPrefix = isPositive ? '+HTG ' : '-HTG ';
    
    let Icon = ArrowUpRight;
    let badgeText = '';
    let badgeColor = '';
    let badgeBg = '';

    if (item.type === 'transfer_sent') {
      Icon = ArrowUpRight;
      badgeText = 'Envoyé';
      badgeColor = '#EF4444';
      badgeBg = 'rgba(239, 68, 68, 0.1)';
    } else if (item.type === 'transfer_received') {
      Icon = ArrowDown;
      badgeText = 'Reçu';
      badgeColor = '#22C55E';
      badgeBg = 'rgba(34, 197, 94, 0.1)';
    } else if (item.type === 'withdrawal') {
      Icon = ArrowUpRight;
      badgeText = 'Retrait';
      badgeColor = '#EF4444';
      badgeBg = 'rgba(239, 68, 68, 0.1)';
    }

    return (
      <TouchableOpacity 
        style={styles.activityItem}
        activeOpacity={0.7}
        onPress={() => setSelectedActivity(item)}
      >
        <View style={styles.activityIconContainer}>
          <Icon size={24} color="#FF7A00" />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.activitySubtitle}>
            {item.type === 'withdrawal' ? 'Retrait' : 'Transfert B2B'}
          </Text>
          <Text style={styles.activityDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.activityRight}>
          <Text style={[styles.activityAmount, { color: amountColor }]}>
            {amountPrefix}{formatAmount(item.amount)}
          </Text>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  }, [formatAmount, formatDate]);

  const ListHeader = useMemo(() => (
    <View style={styles.content}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Solde total</Text>
          <TouchableOpacity onPress={toggleBalance} style={styles.eyeButton}>
            {showBalance ? <Eye size={20} color="#9CA3AF" /> : <EyeOff size={20} color="#9CA3AF" />}
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>
          {showBalance ? `HTG ${formatAmount(balanceData?.balance || 0)}` : 'HTG ••••••'}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(modals)/transfer')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconBg}>
              <Send size={24} color="#FF7A00" />
            </View>
            <View>
              <Text style={styles.actionTitle}>Transférer</Text>
              <Text style={styles.actionSubtitle}>Vers un compte</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(modals)/withdrawal')}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconBg}>
              <Download size={24} color="#FF7A00" />
            </View>
            <View>
              <Text style={styles.actionTitle}>Retirer</Text>
              <Text style={styles.actionSubtitle}>Retrait MonCash</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity Header */}
      <View style={styles.activityHeader}>
        <Text style={styles.activityHeaderText}>Activité récente</Text>
        <TouchableOpacity onPress={() => router.push('/(modals)/history')}>
          <Text style={styles.seeAllText}>Voir tout</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [balanceData, showBalance, toggleBalance, formatAmount, router]);

  const ListEmpty = useMemo(() => {
    if (isLoadingBalance && !isRefetching) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.secondaryText}>Chargement des activités...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.secondaryText}>Aucune activité récente</Text>
      </View>
    );
  }, [isLoadingBalance, isRefetching]);

  const unreadCount = dashboardData?.unreadNotifications || 0;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <DashboardHeader 
        merchant={merchant as any} 
        unreadCount={unreadCount} 
        onNotificationPress={() => router.push('/(modals)/notifications')}
        onScanPress={() => setIsQrModalVisible(true)}
      />

      {/* FlashList Area */}
      <View style={{ flex: 1 }}>
        <FlashList
          data={balanceData?.history || []}
          renderItem={renderActivityItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor="#FF7A00"
              colors={['#FF7A00']}
            />
          }
        />
      </View>

      {/* Bottom Sheet Modal */}
      <QRBottomSheet 
        visible={isQrModalVisible} 
        onClose={() => setIsQrModalVisible(false)}
        onMyQrPress={() => { 
          setIsQrModalVisible(false);
          setIsMyQrSheetVisible(true);
        }}
        onScanQrPress={() => { 
          setIsQrModalVisible(false);
          router.push('/(modals)/scanner');
        }}
      />

      <MyQRSheet 
        visible={isMyQrSheetVisible} 
        onClose={() => setIsMyQrSheetVisible(false)} 
        merchant={merchant} 
      />

      {/* Activity Detail Modal */}
      <Modal
        visible={!!selectedActivity}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedActivity(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de l'activité</Text>
              <TouchableOpacity onPress={() => setSelectedActivity(null)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedActivity && (
              <View style={styles.modalBody}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Type</Text>
                  <Text style={styles.modalValue}>{selectedActivity.type === 'withdrawal' ? 'Retrait MonCash' : 'Transfert B2B'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Montant net</Text>
                  <Text style={[styles.modalValue, { color: selectedActivity.amount_type === 'positive' ? '#22C55E' : '#EF4444' }]}>
                    {formatAmount(selectedActivity.amount)} HTG
                  </Text>
                </View>
                {selectedActivity.fees !== undefined && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Frais appliqués</Text>
                    <Text style={[styles.modalValue, { color: '#FF7A00' }]}>
                      {formatAmount(selectedActivity.fees)} HTG
                    </Text>
                  </View>
                )}
                {selectedActivity.total !== undefined && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Montant brut</Text>
                    <Text style={styles.modalValue}>
                      {formatAmount(selectedActivity.total)} HTG
                    </Text>
                  </View>
                )}
                {selectedActivity.kobara_reference && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Référence</Text>
                    <Text style={styles.modalValue}>{selectedActivity.kobara_reference}</Text>
                  </View>
                )}
                {selectedActivity.wallet && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Destinataire</Text>
                    <Text style={styles.modalValue}>{selectedActivity.wallet}</Text>
                  </View>
                )}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Date</Text>
                  <Text style={styles.modalValue}>{formatDate(selectedActivity.date)}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Statut</Text>
                  <Text style={styles.modalValue}>{selectedActivity.status}</Text>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setSelectedActivity(null)}
            >
              <Text style={styles.modalCloseBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FF7A00',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 8,
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#101827',
    borderRadius: 16,
    padding: 20,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginRight: 8,
  },
  eyeButton: {
    padding: 4,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#FF7A00',
    fontSize: 12,
    marginRight: 4,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  actionDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  activityHeaderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: '#FF7A00',
    fontSize: 14,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#101827',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
    marginRight: 8,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  activitySubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 2,
  },
  activityDate: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F1626',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  modalBody: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  modalValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
