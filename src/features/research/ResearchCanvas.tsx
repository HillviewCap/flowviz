import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Chip, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CircularProgress from '@mui/material/CircularProgress';
import { HypothesisNode, QuestionNode, EvidenceNode, NoteNode } from './components/nodes/ResearchNode';
import { NodePalette } from './components/NodePalette';
import { useResearchSession, type SaveStatus } from './hooks/useResearchSession';

const nodeTypes = {
  hypothesis: HypothesisNode,
  question: QuestionNode,
  evidence: EvidenceNode,
  note: NoteNode,
};

let nodeIdCounter = 1;
function nextId() { return `rn-${Date.now()}-${nodeIdCounter++}`; }

function SaveIndicator({ status }: { status: SaveStatus }) {
  const configs: Record<SaveStatus, { label: string; color: string; icon: React.ReactElement }> = {
    saved:   { label: 'Saved', color: '#16a34a', icon: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> },
    saving:  { label: 'Saving…', color: '#f59e0b', icon: <CircularProgress size={12} sx={{ color: '#f59e0b' }} /> },
    unsaved: { label: 'Unsaved', color: '#f59e0b', icon: <></> },
    offline: { label: 'Working offline', color: '#ef4444', icon: <CloudOffIcon sx={{ fontSize: 14 }} /> },
  };
  const { label, color, icon } = configs[status];
  return (
    <Chip
      size="small"
      icon={icon as React.ReactElement}
      label={label}
      sx={{ background: 'rgba(0,0,0,0.5)', color, border: `1px solid ${color}33`, fontSize: '0.7rem', height: 24 }}
    />
  );
}

function ResearchCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getViewport } = useReactFlow();
  const { sessionId, saveStatus, loadCanvas, scheduleAutoSave, createSession } = useResearchSession();
  const initialLoadDone = useRef(false);

  // Load canvas on mount if session exists
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadCanvas().then(state => {
      if (state) {
        setNodes(state.nodes as Node[]);
        setEdges(state.edges as Edge[]);
      }
    });
  }, [loadCanvas, setNodes, setEdges]);

  // Schedule auto-save on every change after first load
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  // Trigger auto-save whenever nodes or edges change
  useEffect(() => {
    if (!initialLoadDone.current) return;
    scheduleAutoSave(nodes, edges, getViewport());
  }, [nodes, edges, scheduleAutoSave, getViewport]);

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, animated: true }, eds));
  }, [setEdges]);

  const handleAddNode = useCallback(async (type: string) => {
    let sid = sessionId;
    if (!sid) {
      sid = await createSession();
    }
    const id = nextId();
    const newNode: Node = {
      id,
      type,
      position: { x: 250 + Math.random() * 100, y: 150 + Math.random() * 100 },
      data: {
        label: type,
        content: '',
        onChange: (content: string) => {
          setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, content } } : n));
        },
      },
    };
    setNodes(nds => [...nds, newNode]);
  }, [sessionId, createSession, setNodes]);

  return (
    <Box sx={{ width: '100vw', height: '100vh', background: '#0d1117', position: 'relative' }}>
      {/* Header bar */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1,
        background: 'rgba(13,17,23,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Typography variant="subtitle2" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.75rem' }}>
          Research Hub
        </Typography>
        <SaveIndicator status={saveStatus} />
      </Box>

      {/* Node palette */}
      <Box sx={{ pt: '44px', width: '100%', height: '100%', position: 'relative' }}>
        <NodePalette onAddNode={handleAddNode} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />
          <Controls style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.08)' }} />
          <MiniMap
            style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.08)' }}
            nodeColor={() => '#334155'}
          />
        </ReactFlow>
      </Box>
    </Box>
  );
}

export default function ResearchCanvas() {
  return (
    <ReactFlowProvider>
      <ResearchCanvasInner />
    </ReactFlowProvider>
  );
}
