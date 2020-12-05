package com.myorg.msm;

import java.util.Iterator;
import org.apache.sling.api.adapter.Adaptable;
import org.apache.sling.api.resource.Resource;

public interface RolloutHierarchicalObj extends Adaptable {
  String getPath();
  
  Resource getContentResource();
  
  Iterator<RolloutHierarchicalObj> listChildren();
  
  String getName();
  
  String getTitle();
  
  boolean hasContent();
  
  ModificationProperties getModificationProperties();
}
