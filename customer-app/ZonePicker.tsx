import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { s } from './ui';

export interface Zone {
  id: number;
  name: string;
}

export const normName = (v: string) => v.trim().toLowerCase();

export function findZone(zones: Zone[], name: string): Zone | undefined {
  const k = normName(name);
  return zones.find((z) => normName(z.name) === k);
}

export default function ZonePicker(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  zones: Zone[];
}) {
  const [focused, setFocused] = useState(false);
  const q = normName(props.value);
  const exact = findZone(props.zones, props.value);
  const items = props.zones.filter((z) => normName(z.name).includes(q)).slice(0, 6);
  const showList = focused && !exact && items.length > 0;
  const invalid = props.value.trim() !== '' && !exact;
  return (
    <View>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        style={[s.input, invalid && { borderColor: '#b42318' }]}
        value={props.value}
        onChangeText={props.onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder="اكتب للبحث في المناطق"
      />
      {showList ? (
        <View style={s.suggest}>
          {items.map((z) => (
            <Pressable
              key={z.id}
              style={s.suggestItem}
              onPress={() => {
                props.onChange(z.name);
                setFocused(false);
              }}
            >
              <Text style={s.text}>{z.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
