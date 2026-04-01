import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PremiumHeader } from '../components/shared/PremiumHeader';
import { EmptyState } from '../components/ui';
import { trpc } from '../api/trpc';

const joinWithBullet = (items: string[]) => items.filter(Boolean).join(' • ');

const renderValue = (value: string | null | undefined) => value || 'Non renseigné';

export default function MedicationDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const medicationQuery = trpc.medicaments.getMobileMedicamentById.useQuery({
    id: Number(params.id),
  });
  const medication = medicationQuery.data;

  if (!medication) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="medkit-outline"
          title="Médicament introuvable"
          description="Impossible de retrouver cette fiche dans le dataset local."
          actionLabel="Retour"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PremiumHeader
          title={medication.name}
          subtitle={medication.genericName || medication.category}
          onBack={() => router.back()}
        />

        <View style={styles.content}>
          <InfoSection title="Aperçu" icon="pricetag-outline">
            <InfoGrid
              items={[
                { label: 'Catégorie', value: medication.category },
                { label: 'Nom générique', value: renderValue(medication.genericName) },
                { label: 'Famille pharmacologique', value: renderValue(medication.family) },
                { label: 'Classe thérapeutique', value: renderValue(medication.classification) },
              ]}
            />
          </InfoSection>

          {medication.activeSubstances.length > 0 ? (
            <InfoSection title="Substances actives" icon="flask-outline">
              <TagWrap items={medication.activeSubstances} tone="dark" />
            </InfoSection>
          ) : null}

          <InfoSection title="Posologie" icon="pulse-outline">
            <InfoGrid
              items={[
                { label: 'Posologie adulte', value: renderValue(medication.adultDosage) },
                { label: 'Posologie enfant', value: renderValue(medication.childDosage) },
                { label: 'Dose maximale', value: renderValue(medication.maxDose) },
                { label: 'Fréquence d’administration', value: renderValue(medication.administrationFrequency) },
              ]}
            />
          </InfoSection>

          {medication.presentations.length > 0 ? (
            <InfoSection title="Présentations" icon="cube-outline">
              {medication.presentations.slice(0, 8).map((presentation, index) => (
                <View key={`${presentation.forme}-${index}`} style={[styles.itemCard, index > 0 && styles.itemSpacing]}>
                  <Text style={styles.itemTitle}>{presentation.dosage || 'Présentation'}</Text>
                  <Text style={styles.itemText}>{presentation.forme}</Text>
                </View>
              ))}
            </InfoSection>
          ) : null}

          <InfoSection title="Informations cliniques" icon="document-text-outline">
            <FieldBlock label="Indications" value={joinWithBullet(medication.indications) || 'Non renseigné'} />
            <FieldBlock label="Contre-indications" value={joinWithBullet(medication.contraIndications) || 'Non renseigné'} />
            <FieldBlock label="Précautions" value={joinWithBullet(medication.precautions) || 'Non renseigné'} />
          </InfoSection>

          {medication.sideEffects.length > 0 ? (
            <InfoSection title="Effets indésirables" icon="alert-circle-outline">
              {medication.sideEffects.slice(0, 12).map((effect, index) => (
                <View key={`${effect.effect}-${index}`} style={[styles.itemCard, index > 0 && styles.itemSpacing]}>
                  {effect.frequency ? <Text style={styles.itemTitle}>{effect.frequency}</Text> : null}
                  <Text style={styles.itemText}>{effect.effect}</Text>
                </View>
              ))}
            </InfoSection>
          ) : null}

          <InfoSection title="Sécurité" icon="shield-checkmark-outline">
            <InfoGrid
              items={[
                { label: 'Grossesse', value: renderValue(medication.pregnancy) },
                { label: 'Allaitement', value: renderValue(medication.breastfeeding) },
              ]}
            />
          </InfoSection>

          {medication.interactions.length > 0 ? (
            <InfoSection title="Interactions" icon="git-compare-outline">
              {medication.interactions.slice(0, 8).map((interaction, index) => (
                <FieldBlock key={`${interaction}-${index}`} label={`Interaction ${index + 1}`} value={interaction} />
              ))}
            </InfoSection>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color="#0F3460" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <View>
      {items.map((item, index) => (
        <FieldBlock key={`${item.label}-${index}`} label={item.label} value={item.value} />
      ))}
    </View>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLongValue = value.length > 220 || value.includes(' • ') || value.includes('\n');

  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isLongValue ? (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setExpanded((current) => !current)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color="#0F3460"
            />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.fieldValueWrap}>
        <Text style={styles.fieldValue} numberOfLines={isLongValue && !expanded ? 6 : undefined}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function TagWrap({ items, tone }: { items: string[]; tone: 'dark' | 'light' }) {
  return (
    <View style={styles.tagWrap}>
      {items.map((item) => (
        <View key={item} style={[styles.tagChip, tone === 'dark' ? styles.tagChipDark : styles.tagChipLight]}>
          <Text style={[styles.tagChipText, tone === 'dark' ? styles.tagChipTextDark : styles.tagChipTextLight]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F4F7F9',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 24,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F3460',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F3460',
    letterSpacing: -0.3,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3460',
    flex: 1,
    marginRight: 10,
  },
  expandButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  fieldValueWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCEAF7',
    backgroundColor: '#F8FBFD',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldValue: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  itemCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FBFD',
    padding: 14,
  },
  itemSpacing: {
    marginTop: 12,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3460',
    marginBottom: 6,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  tagChipDark: {
    backgroundColor: '#163F75',
  },
  tagChipLight: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DCEAF7',
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tagChipTextDark: {
    color: '#FFFFFF',
  },
  tagChipTextLight: {
    color: '#0F3460',
  },
});
