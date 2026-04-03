import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { EmptyState } from '../components/ui';
import { trpc } from '../api/trpc';

type MedicationSummary = {
  id: number;
  name: string;
  genericName: string | null;
  category: string;
  classification: string | null;
  family: string | null;
  usageSnippet: string | null;
  alphabet: string;
  searchKey: string;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const shorten = (value: string | null, max = 110) => {
  if (!value) {
    return null;
  }

  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
};

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes les catégories');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const { data: catalogFilters } = trpc.medicaments.getMobileCatalogFilters.useQuery();
  const { data: searchResult } = trpc.medicaments.searchMobileCatalog.useQuery({
    query: query.trim() || undefined,
    starts_with: query.trim() ? undefined : selectedLetter,
    category: selectedCategory === 'Toutes les catégories' ? undefined : selectedCategory,
    limit: 80,
  });

  const categories = useMemo(
    () => ['Toutes les catégories', ...(catalogFilters?.categories || [])],
    [catalogFilters?.categories]
  );
  const totalCount = catalogFilters?.totalCount || 0;
  const visibleMedications = searchResult?.items || [];
  const filteredCount = searchResult?.total || 0;
  const sectionTitle = query.trim()
    ? `Résultats pour "${query.trim()}"`
    : `Médicaments commençant par "${selectedLetter}"`;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#0F3460', '#123865', '#285487']}
          locations={[0.3, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Médicaments</Text>
              <Text style={styles.headerSubtitle}>Accédez rapidement à {totalCount.toLocaleString('fr-FR')} médicaments</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#64748B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un médicament..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.categoryButton} onPress={() => setShowCategoryModal(true)} activeOpacity={0.85}>
              <View>
                <Text style={styles.categoryLabel}>Catégorie</Text>
                <Text style={styles.categoryValue} numberOfLines={1}>{selectedCategory}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#0F3460" />
            </TouchableOpacity>

              <View style={styles.filterCountPill}>
              <Text style={styles.filterCountValue}>{filteredCount}</Text>
              <Text style={styles.filterCountLabel}>trouvés</Text>
            </View>
          </View>

          <LinearGradient colors={['transparent', 'rgba(255, 255, 255, 0.05)']} style={styles.bottomFade} />
        </LinearGradient>

        <View style={styles.content}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.letterRail}>
            {ALPHABET.map((letter) => {
              const active = selectedLetter === letter;
              return (
                <TouchableOpacity
                  key={letter}
                  style={[styles.letterChip, active && styles.letterChipActive]}
                  onPress={() => setSelectedLetter(letter)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.letterChipText, active && styles.letterChipTextActive]}>{letter}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.resultsHeader}>
            <View style={styles.resultsBadge}>
              <Text style={styles.resultsBadgeText}>{query.trim() ? 'S' : selectedLetter}</Text>
            </View>
            <View style={styles.resultsCopy}>
              <Text style={styles.resultsTitle}>{sectionTitle}</Text>
              <Text style={styles.resultsSubtitle}>{filteredCount} médicament{filteredCount > 1 ? 's' : ''} trouvés</Text>
            </View>
          </View>

          {visibleMedications.length === 0 ? (
            <EmptyState
              icon="medkit-outline"
              title="Aucun médicament"
              description="Essayez une autre recherche, une autre lettre ou changez la catégorie sélectionnée."
            />
          ) : (
            visibleMedications.map((medication) => (
              <MedicationCard key={medication.id} medication={medication} />
            ))
          )}

          {filteredCount > visibleMedications.length ? (
            <Text style={styles.moreResultsText}>Les {visibleMedications.length} premiers résultats sont affichés pour garder une navigation fluide.</Text>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrer par catégorie</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {categories.map((category) => {
                const active = selectedCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.modalOption, active && styles.modalOptionActive]}
                    onPress={() => {
                      setSelectedCategory(category);
                      setShowCategoryModal(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{category}</Text>
                    {active ? <Ionicons name="checkmark" size={18} color="#0F3460" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MedicationCard({ medication }: { medication: MedicationSummary }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/medications/${medication.id}` as never)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{medication.name}</Text>
          {medication.genericName ? <Text style={styles.cardSubtitle}>{medication.genericName}</Text> : null}
        </View>
        <View style={styles.cardIconWrap}>
          <Ionicons name="medkit-outline" size={18} color="#0F3460" />
        </View>
      </View>

      <View style={styles.cardTags}>
        <View style={styles.primaryTag}>
          <Text style={styles.primaryTagText} numberOfLines={1}>{medication.category}</Text>
        </View>
        {medication.family ? (
          <View style={styles.secondaryTag}>
            <Text style={styles.secondaryTagText} numberOfLines={1}>{shorten(medication.family, 28)}</Text>
          </View>
        ) : null}
      </View>

      {medication.usageSnippet ? <Text style={styles.cardSnippet}>{shorten(medication.usageSnippet, 140)}</Text> : null}

      <View style={styles.cardFooter}>
        <View style={styles.viewButton}>
          <Ionicons name="eye-outline" size={16} color="#0F3460" />
          <Text style={styles.viewButtonText}>Voir les informations</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  headerTop: {
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.84)',
    marginTop: 4,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 10,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginRight: 12,
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  categoryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F3460',
    maxWidth: 210,
  },
  filterCountPill: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  filterCountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterCountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
    marginTop: 2,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  content: {
    padding: 24,
    paddingTop: 20,
  },
  letterRail: {
    paddingBottom: 6,
  },
  letterChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEAF7',
    marginRight: 10,
  },
  letterChipActive: {
    backgroundColor: '#0F3460',
    borderColor: '#0F3460',
  },
  letterChipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F3460',
  },
  letterChipTextActive: {
    color: '#FFFFFF',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 10,
  },
  resultsBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    marginRight: 14,
  },
  resultsBadgeText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  resultsCopy: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F3460',
    letterSpacing: -0.5,
  },
  resultsSubtitle: {
    fontSize: 15,
    color: '#2563EB',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardCopy: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  primaryTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#163F75',
    marginRight: 8,
    marginBottom: 8,
  },
  primaryTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DCEAF7',
    marginBottom: 8,
  },
  secondaryTagText: {
    color: '#0F3460',
    fontSize: 12,
    fontWeight: '600',
  },
  cardSnippet: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EFF4F9',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  viewButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3460',
  },
  moreResultsText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F3460',
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalOptionActive: {
    backgroundColor: '#F8FAFC',
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
    marginRight: 12,
  },
  modalOptionTextActive: {
    color: '#0F3460',
  },
});
