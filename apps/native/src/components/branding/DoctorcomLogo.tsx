import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { SvgXml } from 'react-native-svg';

interface DoctorcomLogoProps {
  width?: number;
  height?: number;
}

const logoAsset = Asset.fromModule(require('../../../assets/images/Logo-doctorcom.svg'));

export function DoctorcomLogo({ width = 230, height = 110 }: DoctorcomLogoProps) {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLogo = async () => {
      try {
        await logoAsset.downloadAsync();
        const logoUri = logoAsset.localUri || logoAsset.uri;

        if (!logoUri) {
          return;
        }

        const svgMarkup = await FileSystem.readAsStringAsync(logoUri);

        if (isMounted) {
          setXml(svgMarkup);
        }
      } catch {
        if (isMounted) {
          setXml(null);
        }
      }
    };

    loadLogo();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!xml) {
    return (
      <View style={[styles.placeholder, { width, height }]}> 
        <ActivityIndicator color="#FFFFFF" size="small" />
      </View>
    );
  }

  return <SvgXml xml={xml} width={width} height={height} />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
