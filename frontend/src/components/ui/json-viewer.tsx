import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface JsonViewerProps {
  data: unknown;
  defaultExpanded?: boolean;
  className?: string;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth?: number;
  defaultExpanded?: boolean;
  isLast?: boolean;
}

function JsonNode({ keyName, value, depth = 0, defaultExpanded = false, isLast = false }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0 ? defaultExpanded : false);
  
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  
  const indent = depth * 16;
  
  if (!isExpandable) {
    return (
      <div className="flex items-start" style={{ paddingLeft: `${indent}px` }}>
        {/* Add space for missing chevron icon to maintain alignment */}
        <div className="w-5 mr-1" />
        {keyName && (
          <span className="text-blue-600 dark:text-blue-400 mr-2">"{keyName}":</span>
        )}
        <span className={cn(
          typeof value === 'string' && 'text-green-600 dark:text-green-400',
          typeof value === 'number' && 'text-orange-600 dark:text-orange-400',
          typeof value === 'boolean' && 'text-purple-600 dark:text-purple-400',
          value === null && 'text-gray-500 dark:text-gray-400'
        )}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }
  
  // const items = isArray ? value : Object.entries(value);
  const itemCount = isArray ? value.length : Object.keys(value).length;
  const preview = isArray 
    ? `[${itemCount} item${itemCount !== 1 ? 's' : ''}]`
    : `{${itemCount} key${itemCount !== 1 ? 's' : ''}}`;
  
  const label = keyName !== undefined ? `"${keyName}"` : 'root';

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-start rounded text-left hover:bg-muted/50"
        style={{ paddingLeft: `${indent}px` }}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
        // Stop propagation so the tree never triggers click handlers on an
        // ancestor (e.g. a row that would collapse the whole message).
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <span className="mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        {keyName && (
          <span className="text-blue-600 dark:text-blue-400 mr-2">"{keyName}":</span>
        )}
        {!isExpanded && (
          <span className="text-muted-foreground">{preview}</span>
        )}
        {isExpanded && (
          <span className="text-muted-foreground">{isArray ? '[' : '{'}</span>
        )}
      </button>

      {isExpanded && (
        <div>
          {isArray ? (
            value.map((item, index) => (
              <JsonNode
                key={index}
                keyName={String(index)}
                value={item}
                depth={depth + 1}
                defaultExpanded={defaultExpanded}
                isLast={index === value.length - 1}
              />
            ))
          ) : (
            Object.entries(value).map(([key, val], index, arr) => (
              <JsonNode
                key={key}
                keyName={key}
                value={val}
                depth={depth + 1}
                defaultExpanded={defaultExpanded}
                isLast={index === arr.length - 1}
              />
            ))
          )}
          <div className="flex items-start" style={{ paddingLeft: `${indent}px` }}>
            <div className="w-5 mr-1" />
            <span className="text-muted-foreground">{isArray ? ']' : '}'}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function JsonViewer({ data, defaultExpanded = false, className }: JsonViewerProps) {
  const parsedData = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }, [data]);
  
  const isJson = typeof parsedData === 'object' && parsedData !== null;
  
  if (!isJson) {
    return (
      <pre className={cn("text-sm bg-muted p-2 rounded overflow-x-auto font-mono", className)}>
        {String(data)}
      </pre>
    );
  }
  
  return (
    <div className={cn("text-sm bg-muted p-2 rounded overflow-x-auto font-mono", className)}>
      <JsonNode value={parsedData} defaultExpanded={defaultExpanded} isLast={true} />
    </div>
  );
}