import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoctorcomLogo } from '@/src/components/branding/DoctorcomLogo';
import { ONBOARDING_COMPLETE_KEY } from '@/src/constants/storage';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 0,
    icon: null,
    title: 'Bienvenue sur\ndoctor.com',
    subtitle:
      "L'outil conçu pour le médecin moderne. Gérez toute votre pratique depuis votre téléphone.",
    gradient: ['#0F3460', '#123865', '#1e4f8a'] as const,
  },
  {
    id: 1,
    icon: 'calendar' as const,
    title: 'Agenda Intelligent',
    subtitle:
      'Visualisez et gérez vos rendez-vous, suivis et consultations en temps réel.',
    gradient: ['#0c2e58', '#0F3460', '#285487'] as const,
  },
  {
    id: 2,
    icon: 'document-text' as const,
    title: 'Mémoire Clinique',
    subtitle:
      "Dictez vos notes, retrouvez l'historique complet de chaque patient instantanément.",
    gradient: ['#0F3460', '#0d2b4e', '#08203a'] as const,
  },
  {
    id: 3,
    icon: 'medkit' as const,
    title: 'Prêt à commencer ?',
    subtitle:
      'Accédez à votre espace professionnel et prenez soin de vos patients avec plus d\'efficacité.',
    gradient: ['#0F3460', '#123865', '#1e4f8a'] as const,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentSlide(index);
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      goTo(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== currentSlide) {
      setCurrentSlide(page);
    }
  };

  const isLast = currentSlide === slides.length - 1;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.slideScroll}
      >
        {slides.map((slide) => (
          <LinearGradient
            key={slide.id}
            colors={[...slide.gradient]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.slide, { paddingTop: insets.top + 60 }]}
          >
            <View style={styles.illustrationArea}>
              {slide.icon === null ? (
                <DoctorcomLogo width={240} height={110} />
              ) : (
                <View style={styles.iconWrap}>
                  <View style={styles.iconInner}>
                    <Ionicons name={slide.icon} size={56} color="#FFFFFF" />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.textArea}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            </View>
          </LinearGradient>
        ))}
      </ScrollView>

      {/* Controls overlay */}
      <View
        style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        pointerEvents="box-none"
      >
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={[styles.dot, i === currentSlide && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        {isLast ? (
          <TouchableOpacity style={styles.startButton} onPress={handleComplete} activeOpacity={0.85}>
            <Text style={styles.startButtonText}>Commencer</Text>
            <Ionicons name="arrow-forward" size={20} color="#0F3460" style={styles.startIcon} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={handleComplete} style={styles.skipButton} activeOpacity={0.7}>
              <Text style={styles.skipText}>Passer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.nextButton} activeOpacity={0.85}>
              <Text style={styles.nextButtonText}>Suivant</Text>
              <Ionicons name="arrow-forward" size={18} color="#0F3460" style={styles.nextIcon} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F3460',
  },
  slideScroll: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  slideTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 44,
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 27,
    maxWidth: 300,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 28,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F3460',
  },
  nextIcon: {
    marginLeft: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F3460',
    letterSpacing: -0.3,
  },
  startIcon: {
    marginLeft: 10,
  },
});
