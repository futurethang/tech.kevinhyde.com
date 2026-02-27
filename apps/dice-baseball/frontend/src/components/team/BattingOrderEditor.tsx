/**
 * BattingOrderEditor - Drag-and-drop batting order editor component
 */

import { useState, useRef } from 'react';
import type { DragEvent } from 'react';
import { Button, Card, CardContent } from '../common';
import type { MLBPlayer, RosterSlot } from '../../types';

interface BattingOrderEditorProps {
  roster: RosterSlot[];
  populatedRoster: Record<string, MLBPlayer>;
  onReorder: (newOrder: number[]) => void;
  onSave: () => void;
  disabled?: boolean;
}

export function BattingOrderEditor({ 
  roster, 
  populatedRoster, 
  onReorder, 
  onSave, 
  disabled = false 
}: BattingOrderEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Filter out pitcher and sort by current batting order
  const battingLineup = roster
    .filter(slot => slot.position !== 'SP' && slot.battingOrder !== null)
    .sort((a, b) => (a.battingOrder || 0) - (b.battingOrder || 0));

  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    if (disabled) return;
    
    setDraggedIndex(index);
    dragCounter.current = 0;
    
    // Set the drag data
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    
    // Style the dragged element
    const target = e.currentTarget;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    const target = e.currentTarget;
    target.style.opacity = '1';
    
    setDraggedIndex(null);
    setDropTargetIndex(null);
    dragCounter.current = 0;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || draggedIndex === null) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>, index: number) => {
    if (disabled || draggedIndex === null) return;
    
    e.preventDefault();
    dragCounter.current++;
    setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    if (disabled || draggedIndex === null) return;
    
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDropTargetIndex(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDropTargetIndex(null);
      return;
    }
    
    e.preventDefault();
    
    // Create new order array
    const newLineup = [...battingLineup];
    const draggedPlayer = newLineup[draggedIndex];
    
    // Remove the dragged item
    newLineup.splice(draggedIndex, 1);
    
    // Insert at new position
    newLineup.splice(dropIndex, 0, draggedPlayer);
    
    // Create new batting order (1-9)
    const newOrder = newLineup.map(slot => slot.mlbPlayerId);
    onReorder(newOrder);
    
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const getDragStyles = (index: number) => {
    let styles = '';
    
    if (draggedIndex === index) {
      styles += ' opacity-50 transform scale-95';
    }
    
    if (dropTargetIndex === index && draggedIndex !== null) {
      styles += ' border-blue-500 border-2 bg-blue-900/20';
    }
    
    return styles;
  };

  const getDropIndicator = (index: number) => {
    if (dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index) {
      const isMovingUp = draggedIndex > index;
      return (
        <div 
          className={`absolute left-0 right-0 h-0.5 bg-blue-500 z-10 ${
            isMovingUp ? '-top-px' : '-bottom-px'
          }`}
        />
      );
    }
    return null;
  };

  if (battingLineup.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No batting order set</div>
            <div className="text-sm text-gray-500">
              Add players to positions to set batting order
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Batting Order</h3>
          <Button 
            size="sm" 
            onClick={onSave}
            disabled={disabled || battingLineup.length !== 9}
          >
            Save Order
          </Button>
        </div>
        
        <div className="text-xs text-gray-500 mb-3">
          Drag and drop to reorder the batting lineup (pitcher not included)
        </div>

        <div className="space-y-2">
          {battingLineup.map((slot, index) => {
            const player = populatedRoster[slot.mlbPlayerId.toString()];
            
            return (
              <div
                key={slot.mlbPlayerId}
                className="relative"
              >
                {getDropIndicator(index)}
                
                <div
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`
                    flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700
                    transition-all duration-200 cursor-move hover:border-gray-600
                    ${getDragStyles(index)}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {/* Batting order number */}
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white text-sm font-bold rounded-full flex-shrink-0">
                    {index + 1}
                  </div>
                  
                  {/* Drag handle */}
                  <div className="text-gray-400 text-sm flex-shrink-0">
                    ⋮⋮
                  </div>
                  
                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">
                        {player?.fullName || `Player ${slot.mlbPlayerId}`}
                      </span>
                      <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded flex-shrink-0">
                        {slot.position}
                      </span>
                    </div>
                    {player && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {player.currentTeam}
                        {player.battingStats && (
                          <span className="ml-2">
                            AVG: {player.battingStats.avg.toFixed(3)} | 
                            OPS: {player.battingStats.ops.toFixed(3)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Position in lineup indicator */}
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {getPositionDescription(index + 1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {battingLineup.length < 9 && (
          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <div className="text-yellow-400 text-sm font-medium mb-1">
              Incomplete Lineup
            </div>
            <div className="text-xs text-yellow-500">
              Need {9 - battingLineup.length} more position players to complete batting order
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getPositionDescription(order: number): string {
  const descriptions: Record<number, string> = {
    1: 'Leadoff',
    2: '2-hole',
    3: 'Cleanup prep',
    4: 'Cleanup',
    5: 'RBI spot',
    6: '6-hole',
    7: '7-hole',
    8: '8-hole',
    9: 'Bottom'
  };
  
  return descriptions[order] || `${order}th`;
}
