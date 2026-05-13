import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Typography, TextField } from '@mui/material';

export interface ResearchNodeData {
  label: string;
  content: string;
  onChange?: (content: string) => void;
}

interface ResearchNodeConfig {
  headerColor: string;
  label: string;
  placeholder: string;
}

const NODE_CONFIGS: Record<string, ResearchNodeConfig> = {
  hypothesis: { headerColor: '#1976d2', label: 'Hypothesis', placeholder: 'State your hypothesis...' },
  question:   { headerColor: '#f59e0b', label: 'Question',   placeholder: 'What do you need to know?' },
  evidence:   { headerColor: '#16a34a', label: 'Evidence',   placeholder: 'Describe the evidence...' },
  note:       { headerColor: '#64748b', label: 'Note',        placeholder: 'Add a note...' },
};

function ResearchNodeBase({ data, type }: NodeProps<ResearchNodeData> & { type: string }) {
  const config = NODE_CONFIGS[type] ?? NODE_CONFIGS.note;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data.content ?? '');

  // Sync if parent updates data.content (e.g. on canvas restore from server)
  useEffect(() => {
    if (!editing) setValue(data.content ?? '');
  }, [data.content, editing]);

  const handleBlur = () => {
    setEditing(false);
    data.onChange?.(value);
  };

  return (
    <Box sx={{
      minWidth: 200,
      maxWidth: 280,
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.12)',
      background: '#1e2130',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    }}>
      <Handle type="target" position={Position.Top} />
      <Box sx={{ background: config.headerColor, px: 1.5, py: 0.75 }}>
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          {config.label}
        </Typography>
      </Box>
      <Box sx={{ p: 1.5 }} onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <TextField
            autoFocus
            multiline
            fullWidth
            size="small"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={config.placeholder}
            variant="standard"
            sx={{ '& .MuiInput-root': { color: '#e2e8f0', fontSize: '0.8rem' } }}
          />
        ) : (
          <Typography variant="body2" sx={{ color: '#e2e8f0', fontSize: '0.8rem', minHeight: 40, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {value || <span style={{ opacity: 0.4 }}>{config.placeholder}</span>}
          </Typography>
        )}
      </Box>
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}

export const HypothesisNode = memo((props: NodeProps<ResearchNodeData>) => <ResearchNodeBase {...props} type="hypothesis" />);
export const QuestionNode   = memo((props: NodeProps<ResearchNodeData>) => <ResearchNodeBase {...props} type="question" />);
export const EvidenceNode   = memo((props: NodeProps<ResearchNodeData>) => <ResearchNodeBase {...props} type="evidence" />);
export const NoteNode       = memo((props: NodeProps<ResearchNodeData>) => <ResearchNodeBase {...props} type="note" />);

HypothesisNode.displayName = 'HypothesisNode';
QuestionNode.displayName   = 'QuestionNode';
EvidenceNode.displayName   = 'EvidenceNode';
NoteNode.displayName       = 'NoteNode';
