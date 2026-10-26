import React from 'react';
import { Text, TouchableOpacity, Platform, Linking, StyleSheet } from 'react-native';
import { COLORS } from './Theme';

interface LocationLinkProps {
  location: string | null;
  city?: string | null;
  province_state?: string | null;
  country?: string | null;
  style?: any;
}

export function LocationLink({
  location,
  city,
  province_state,
  country,
  style,
}: LocationLinkProps) {
  const displayLabel = location || [city, province_state, country].filter(Boolean).join(', ') || 'No location';

  const handlePress = async () => {
    if (!displayLabel || displayLabel === 'No location' || displayLabel.toLowerCase() === 'online') {
      return;
    }

    const query = encodeURIComponent(displayLabel);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });

    try {
      const supported = await Linking.canOpenURL(url!);
      if (supported) {
        await Linking.openURL(url!);
      } else {
        // Fallback to web browser search
        await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      }
    } catch (err) {
      console.warn('Failed to open location link:', err);
    }
  };

  const isClickable = displayLabel !== 'No location' && displayLabel.toLowerCase() !== 'online';

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!isClickable}
      activeOpacity={0.7}
      accessibilityLabel={`Location: ${displayLabel}`}
      accessibilityRole={isClickable ? 'link' : undefined}
    >
      <Text style={[styles.text, isClickable && styles.linkText, style]}>
        {displayLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  linkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
