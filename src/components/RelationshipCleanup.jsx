/**
 * @file RelationshipCleanup.jsx
 * @description Component to clean up old trainer-client relationships
 * @author Felony Fitness Development Team
 * @version 1.0.0
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { supabase } from '../supabaseClient.js';

const RelationshipCleanup = () => {
  const { user } = useAuth();
  const [relationships, setRelationships] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (user) {
      loadCurrentData();
    }
    // loadCurrentData changes on every render, so we can't include it safely
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addResult = (message, isSuccess = true) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, {
      message,
      isSuccess,
      timestamp
    }]);
  };

  const loadCurrentData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load trainer-client relationships involving current user
      const { data: relationshipData, error: relError } = await supabase
        .from('trainer_clients')
        .select(`
          *,
          trainer:user_profiles!trainer_clients_trainer_id_fkey(email, first_name, last_name),
          client:user_profiles!trainer_clients_client_id_fkey(email, first_name, last_name)
        `)
        .or(`trainer_id.eq.${user.id},client_id.eq.${user.id}`);

      if (relError) {
        console.error('Error loading relationships:', relError);
        addResult(`❌ Error loading relationships: ${relError.message}`, false);
      } else {
        setRelationships(relationshipData || []);
        addResult(`📊 Found ${relationshipData?.length || 0} relationships involving you`);
      }

      // Load user tags for current user
      const { data: tagData, error: tagError } = await supabase
        .from('user_tags')
        .select(`
          *,
          tag:tags(name)
        `)
        .eq('user_id', user.id);

      if (tagError) {
        console.error('Error loading tags:', tagError);
        addResult(`❌ Error loading tags: ${tagError.message}`, false);
      } else {
        setUserTags(tagData || []);
        addResult(`🏷️ Found ${tagData?.length || 0} tags assigned to you`);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      addResult(`❌ Error: ${error.message}`, false);
    } finally {
      setLoading(false);
    }
  };

  const cleanupRelationships = async () => {
    if (!user) return;
    
    setLoading(true);
    addResult('🧹 Starting relationship cleanup...');

    try {
      // Delete trainer-client relationships
      const { error: relError } = await supabase
        .from('trainer_clients')
        .delete()
        .or(`trainer_id.eq.${user.id},client_id.eq.${user.id}`);

      if (relError) {
        addResult(`❌ Error deleting relationships: ${relError.message}`, false);
      } else {
        addResult('✅ Successfully deleted old trainer-client relationships');
      }

      // Remove Client and Trainer tags (keep User tag)
      const { error: tagError } = await supabase
        .from('user_tags')
        .delete()
        .eq('user_id', user.id)
        .in('tag_id', await getTagIds(['Client', 'Trainer']));

      if (tagError) {
        addResult(`❌ Error deleting role tags: ${tagError.message}`, false);
      } else {
        addResult('✅ Successfully removed old role tags (kept User tag)');
      }

      // Reload data to show results
      await loadCurrentData();
      addResult('🎉 Cleanup completed! You can now re-onboard properly.');

    } catch (error) {
      console.error('Cleanup error:', error);
      addResult(`❌ Cleanup failed: ${error.message}`, false);
    } finally {
      setLoading(false);
    }
  };

  const getTagIds = async (tagNames) => {
    const { data: tags } = await supabase
      .from('tags')
      .select('id')
      .in('name', tagNames);
    
    return tags?.map(tag => tag.id) || [];
  };

  const clearResults = () => {
    setResults([]);
  };

  if (!user) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Please log in to use the relationship cleanup tool.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '20px auto', 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2>🧹 Relationship Cleanup Tool</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <h3>Current User</h3>
        <p>
          <strong>Email:</strong> {user.email}<br/>
          <strong>ID:</strong> {user.id}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Current Relationships ({relationships.length})</h3>
        {relationships.length > 0 ? (
          <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
            {relationships.map((rel, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                <strong>
                  {rel.trainer_id === user.id ? 'You → Client' : 'Trainer → You'}:
                </strong>{' '}
                {rel.trainer_id === user.id 
                  ? `${rel.client?.first_name} ${rel.client?.last_name} (${rel.client?.email})`
                  : `${rel.trainer?.first_name} ${rel.trainer?.last_name} (${rel.trainer?.email})`
                } - Status: {rel.relationship_status}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No relationships found.</p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Current Tags ({userTags.length})</h3>
        {userTags.length > 0 ? (
          <div style={{ backgroundColor: '#d1ecf1', padding: '10px', borderRadius: '5px' }}>
            {userTags.map((userTag, index) => (
              <span 
                key={index}
                style={{ 
                  display: 'inline-block',
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  marginRight: '5px',
                  fontSize: '12px'
                }}
              >
                {userTag.tag?.name}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No tags found.</p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={cleanupRelationships}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? '🔄 Cleaning...' : '🧹 Clean Up Old Relationships'}
        </button>

        <button 
          onClick={loadCurrentData}
          disabled={loading}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          🔄 Refresh Data
        </button>

        <button 
          onClick={clearResults}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Clear Log
        </button>
      </div>

      <div>
        <h3>Cleanup Log</h3>
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '5px',
          padding: '15px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {results.length === 0 ? (
            <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
              Click "Refresh Data" to load your current relationships and tags.
            </p>
          ) : (
            results.map((result, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '5px',
                  color: result.isSuccess ? '#28a745' : '#dc3545'
                }}
              >
                <small style={{ color: '#6c757d' }}>[{result.timestamp}]</small> {result.message}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#d4edda', 
        borderRadius: '5px',
        border: '1px solid #c3e6cb'
      }}>
        <h4>What This Does:</h4>
        <ul>
          <li>Removes your old trainer-client relationships</li>
          <li>Removes old "Client" and "Trainer" role tags</li>
          <li>Keeps your "User" tag intact</li>
          <li>Allows you to re-onboard with the improved system</li>
        </ul>
        <p><strong>After cleanup:</strong> Use the Client Onboarding tool to create a proper trainer-client relationship with email matching.</p>
      </div>
    </div>
  );
};

export default RelationshipCleanup;