import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const PALETTE_ITEMS = [
  { type: 'hypothesis', label: 'Hypothesis', color: '#1976d2', description: 'A testable claim' },
  { type: 'question',   label: 'Question',   color: '#f59e0b', description: 'Something to investigate' },
  { type: 'evidence',   label: 'Evidence',   color: '#16a34a', description: 'Supporting data or finding' },
  { type: 'note',       label: 'Note',       color: '#64748b', description: 'Free-form annotation' },
];

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <Box sx={{
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      {PALETTE_ITEMS.map(item => (
        <Paper
          key={item.type}
          elevation={4}
          onClick={() => onAddNode(item.type)}
          sx={{
            cursor: 'pointer',
            width: 120,
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#1e2130',
            transition: 'transform 0.15s, box-shadow 0.15s',
            '&:hover': { transform: 'scale(1.04)', boxShadow: `0 0 0 2px ${item.color}` },
          }}
        >
          <Box sx={{ background: item.color, px: 1, py: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {item.label}
            </Typography>
          </Box>
          <Box sx={{ px: 1, py: 0.75 }}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>
              {item.description}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
